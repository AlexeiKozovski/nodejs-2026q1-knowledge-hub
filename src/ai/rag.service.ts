import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../common/errors/domain-errors';
import { AppLogger } from '../common/logging/app.logger';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleStatus } from '../types';
import {
  RagChatRequestDto,
  RagChatResponseDto,
  RagConversationHistoryResponseDto,
  RagConversationMessageDto,
} from './dto/rag-chat.dto';
import { ReindexRequestDto, ReindexResponseDto } from './dto/rag-index.dto';
import {
  RagSearchRequestDto,
  RagSearchResponseDto,
  RagSearchResultDto,
} from './dto/rag-search.dto';
import { GeminiService } from './gemini.service';

interface IndexedPointPayload {
  articleId: string;
  articleTitle: string;
  articleStatus: ArticleStatus;
  categoryId: string | null;
  tags: string[];
  chunk: string;
  chunkIndex: number;
}

interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload?: IndexedPointPayload;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

@Injectable()
export class RagService {
  private readonly logContext = RagService.name;
  private readonly conversationMemory = new Map<
    string,
    ConversationMessage[]
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly geminiService: GeminiService,
    private readonly appLogger: AppLogger,
  ) {}

  async reindex(dto: ReindexRequestDto): Promise<ReindexResponseDto> {
    const onlyPublished = dto.onlyPublished ?? true;

    const articles = await this.prisma.article.findMany({
      where: {
        ...(onlyPublished ? { status: 'PUBLISHED' } : undefined),
        ...(dto.articleIds?.length
          ? { id: { in: dto.articleIds } }
          : undefined),
      },
      include: { tags: true },
      orderBy: { id: 'asc' },
    });

    const chunkSize = this.readChunkSize();
    const chunkOverlap = this.readChunkOverlap(chunkSize);
    const points: Array<{
      id: string;
      vector: number[];
      payload: IndexedPointPayload;
    }> = [];
    let vectorSize: number | null = null;

    for (const article of articles) {
      await this.deleteArticleVectors(article.id);
      const chunks = this.chunkText(article.content, chunkSize, chunkOverlap);
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const vector = await this.geminiService.embedText(chunk);
        vectorSize ??= vector.length;
        points.push({
          id: `${article.id}:${index}`,
          vector,
          payload: {
            articleId: article.id,
            articleTitle: article.title,
            articleStatus: this.fromPrismaStatus(article.status),
            categoryId: article.categoryId,
            tags: article.tags.map((tag) => tag.name),
            chunk,
            chunkIndex: index,
          },
        });
      }
    }

    if (vectorSize !== null) {
      await this.ensureCollection(vectorSize);
      await this.upsertPoints(points);
    }

    return {
      indexedArticles: articles.length,
      indexedChunks: points.length,
      vectorCollection: this.collectionName(),
    };
  }

  async search(dto: RagSearchRequestDto): Promise<RagSearchResponseDto> {
    const vector = await this.geminiService.embedText(dto.query);
    const effectiveLimit = dto.limit ?? 5;
    const raw = await this.searchQdrant(
      vector,
      Math.min(100, effectiveLimit * 5),
      {
        articleStatus: dto.articleStatus,
        categoryId: dto.categoryId,
      },
    );

    const filtered = raw
      .filter((entry) => entry.payload)
      .filter((entry) => {
        if (!dto.tags?.length) {
          return true;
        }
        const pointTags = entry.payload?.tags ?? [];
        return dto.tags.some((tag) => pointTags.includes(tag));
      })
      .slice(0, effectiveLimit)
      .map(
        (entry): RagSearchResultDto => ({
          articleId: entry.payload!.articleId,
          articleTitle: entry.payload!.articleTitle,
          chunk: entry.payload!.chunk,
          similarity: Number(entry.score.toFixed(6)),
        }),
      );

    return { results: filtered };
  }

  async chat(dto: RagChatRequestDto): Promise<RagChatResponseDto> {
    const conversationId = dto.conversationId ?? randomUUID();
    const memory = this.conversationMemory.get(conversationId) ?? [];
    const results = await this.searchQdrantByQuestion(dto.question, 5);
    const sources = results
      .filter((item) => item.payload)
      .slice(0, 5)
      .map((item) => ({
        articleId: item.payload!.articleId,
        articleTitle: item.payload!.articleTitle,
        relevantChunk: item.payload!.chunk,
      }));

    const prompt = this.buildChatPrompt(dto.question, memory, sources);
    const { text: answer } = await this.geminiService.generateText(prompt, {
      maxOutputTokens: 1400,
    });

    this.appendConversationMessage(conversationId, {
      role: 'user',
      text: dto.question,
      timestamp: Date.now(),
    });
    this.appendConversationMessage(conversationId, {
      role: 'assistant',
      text: answer,
      timestamp: Date.now(),
    });

    return {
      answer,
      sources,
      conversationId,
    };
  }

  getConversationHistory(
    conversationId: string,
  ): RagConversationHistoryResponseDto {
    const messages = this.conversationMemory.get(conversationId);
    if (!messages) {
      throw new NotFoundError('Conversation not found');
    }
    return {
      conversationId,
      messages: messages.map(
        (item): RagConversationMessageDto => ({
          role: item.role,
          text: item.text,
          timestamp: item.timestamp,
        }),
      ),
    };
  }

  async deleteArticleFromIndex(articleId: string): Promise<void> {
    const hasVectors = await this.hasArticleVectors(articleId);
    if (!hasVectors) {
      throw new NotFoundError('Article index entries not found');
    }
    await this.deleteArticleVectors(articleId);
  }

  private chunkText(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
  ): string[] {
    const source = text.trim();
    if (!source) {
      return [];
    }

    if (source.length <= chunkSize) {
      return [source];
    }

    const step = Math.max(1, chunkSize - chunkOverlap);
    const chunks: string[] = [];
    for (let start = 0; start < source.length; start += step) {
      const chunk = source
        .slice(start, Math.min(source.length, start + chunkSize))
        .trim();
      if (chunk) {
        chunks.push(chunk);
      }
      if (start + chunkSize >= source.length) {
        break;
      }
    }
    return chunks;
  }

  private readChunkSize(): number {
    const value = Number.parseInt(
      String(this.configService.get('RAG_CHUNK_SIZE') ?? '800'),
      10,
    );
    return Number.isFinite(value) && value > 0 ? value : 800;
  }

  private readChunkOverlap(chunkSize: number): number {
    const value = Number.parseInt(
      String(this.configService.get('RAG_CHUNK_OVERLAP') ?? '200'),
      10,
    );
    if (!Number.isFinite(value) || value < 0) {
      return 200;
    }
    return Math.min(value, Math.max(0, chunkSize - 1));
  }

  private collectionName(): string {
    return (
      this.configService.get<string>('RAG_VECTOR_COLLECTION') ??
      'knowledge_hub_articles'
    );
  }

  private vectorDbUrl(): string {
    return (
      this.configService.get<string>('RAG_VECTOR_DB_URL') ??
      'http://vectordb:6333'
    );
  }

  private async ensureCollection(vectorSize: number): Promise<void> {
    const name = this.collectionName();
    const url = `${this.vectorDbUrl()}/collections/${name}`;
    await this.qdrantRequest(url, {
      method: 'PUT',
      body: {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      },
      tolerateStatus: [409],
    });
  }

  private async upsertPoints(
    points: Array<{
      id: string;
      vector: number[];
      payload: IndexedPointPayload;
    }>,
  ): Promise<void> {
    if (!points.length) {
      return;
    }
    const name = this.collectionName();
    const url = `${this.vectorDbUrl()}/collections/${name}/points?wait=true`;
    await this.qdrantRequest(url, {
      method: 'PUT',
      body: { points },
    });
  }

  private async deleteArticleVectors(articleId: string): Promise<void> {
    const name = this.collectionName();
    const url = `${this.vectorDbUrl()}/collections/${name}/points/delete?wait=true`;
    await this.qdrantRequest(url, {
      method: 'POST',
      body: {
        filter: {
          must: [{ key: 'articleId', match: { value: articleId } }],
        },
      },
      tolerateStatus: [404],
    });
  }

  private async hasArticleVectors(articleId: string): Promise<boolean> {
    const name = this.collectionName();
    const url = `${this.vectorDbUrl()}/collections/${name}/points/scroll`;
    const response = await this.qdrantRequest(url, {
      method: 'POST',
      body: {
        limit: 1,
        with_payload: false,
        with_vector: false,
        filter: {
          must: [{ key: 'articleId', match: { value: articleId } }],
        },
      },
      tolerateStatus: [404],
    });
    const points = response?.result;
    if (!points || typeof points !== 'object') {
      return false;
    }
    const list = (points as { points?: unknown }).points;
    return Array.isArray(list) && list.length > 0;
  }

  private async searchQdrantByQuestion(
    question: string,
    limit: number,
  ): Promise<QdrantSearchResult[]> {
    const vector = await this.geminiService.embedText(question);
    return this.searchQdrant(vector, limit, {});
  }

  private buildChatPrompt(
    question: string,
    memory: ConversationMessage[],
    sources: Array<{
      articleId: string;
      articleTitle: string;
      relevantChunk: string;
    }>,
  ): string {
    const historyBlock = memory
      .slice(-Math.max(0, this.readConversationMaxMessages()))
      .map((message) => `${message.role.toUpperCase()}: ${message.text}`)
      .join('\n');
    const sourcesBlock = sources
      .map(
        (source, index) =>
          `[S${index + 1}] articleId=${source.articleId}; title="${source.articleTitle}"\n${source.relevantChunk}`,
      )
      .join('\n\n');

    return [
      'You are a Knowledge Hub assistant.',
      'Answer ONLY using provided sources. If sources are insufficient, clearly say that information is not found in indexed knowledge.',
      '',
      historyBlock
        ? `Conversation history:\n${historyBlock}`
        : 'Conversation history: (empty)',
      '',
      sourcesBlock
        ? `Retrieved sources:\n${sourcesBlock}`
        : 'Retrieved sources: (empty)',
      '',
      `User question: ${question}`,
      '',
      'Provide concise, factual answer in plain text.',
    ].join('\n');
  }

  private appendConversationMessage(
    conversationId: string,
    message: ConversationMessage,
  ): void {
    const maxMessages = this.readConversationMaxMessages();
    const current = this.conversationMemory.get(conversationId) ?? [];
    const next = [...current, message];
    const trimmed =
      next.length > maxMessages ? next.slice(next.length - maxMessages) : next;
    this.conversationMemory.set(conversationId, trimmed);
  }

  private readConversationMaxMessages(): number {
    const value = Number.parseInt(
      String(this.configService.get('RAG_CONVERSATION_MAX_MESSAGES') ?? '20'),
      10,
    );
    if (!Number.isFinite(value) || value <= 0) {
      return 20;
    }
    return value;
  }

  private async searchQdrant(
    vector: number[],
    limit: number,
    filters: { articleStatus?: ArticleStatus; categoryId?: string },
  ): Promise<QdrantSearchResult[]> {
    const name = this.collectionName();
    const url = `${this.vectorDbUrl()}/collections/${name}/points/search`;
    const must: Array<Record<string, unknown>> = [];
    if (filters.articleStatus) {
      must.push({
        key: 'articleStatus',
        match: { value: filters.articleStatus },
      });
    }
    if (filters.categoryId) {
      must.push({ key: 'categoryId', match: { value: filters.categoryId } });
    }

    const response = await this.qdrantRequest(url, {
      method: 'POST',
      body: {
        vector,
        limit,
        with_payload: true,
        ...(must.length ? { filter: { must } } : undefined),
      },
      tolerateStatus: [404],
    });
    const result = response?.result;
    if (!Array.isArray(result)) {
      return [];
    }
    return result as QdrantSearchResult[];
  }

  private async qdrantRequest(
    url: string,
    options: {
      method: 'GET' | 'POST' | 'PUT';
      body?: Record<string, unknown>;
      tolerateStatus?: number[];
    },
  ): Promise<Record<string, unknown> | null> {
    const timeoutMs = 8000;
    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      this.appLogger.warn(
        `Vector DB request failed: ${error instanceof Error ? error.message : String(error)}`,
        this.logContext,
      );
      throw new ServiceUnavailableException('Vector database is unavailable');
    }

    if (options.tolerateStatus?.includes(response.status)) {
      return null;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.appLogger.warn(
        `Vector DB HTTP ${response.status}: ${body.slice(0, 500)}`,
        this.logContext,
      );
      throw new ServiceUnavailableException('Vector database request failed');
    }

    const text = await response.text().catch(() => '');
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private fromPrismaStatus(status: string): ArticleStatus {
    switch (status) {
      case 'DRAFT':
        return ArticleStatus.DRAFT;
      case 'PUBLISHED':
        return ArticleStatus.PUBLISHED;
      case 'ARCHIVED':
      default:
        return ArticleStatus.ARCHIVED;
    }
  }
}
