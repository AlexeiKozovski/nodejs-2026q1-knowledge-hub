import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { NotFoundError } from '../common/errors/domain-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnalyzeArticleRequestDto,
  AnalyzeArticleResponseDto,
  AnalyzeArticleTask,
} from './dto/analyze-article.dto';
import { AiUsageAndMetricsResponseDto } from './dto/ai-usage-metrics.dto';
import {
  GenerateAiRequestDto,
  GenerateAiResponseDto,
} from './dto/generate.dto';
import {
  SummarizeArticleResponseDto,
  SummaryMaxLength,
} from './dto/summarize-article.dto';
import {
  TranslateArticleRequestDto,
  TranslateArticleResponseDto,
} from './dto/translate-article.dto';
import { AiCacheService } from './ai-cache.service';
import { AiGenerateSessionService } from './ai-generate-session.service';
import { AiObservabilityService } from './ai-observability.service';
import { AiUsageService } from './ai-usage.service';
import { GeminiService } from './gemini.service';
import { buildAnalyzeArticlePrompt } from './prompts/analyze.prompt';
import { buildGenericGeneratePrompt } from './prompts/generic-generate.prompt';
import { buildSummarizeArticlePrompt } from './prompts/summarize.prompt';
import { buildTranslateArticlePrompt } from './prompts/translate.prompt';
import {
  safeParseAnalyzeOrFallback,
  safeParseTranslate,
} from './schemas/structured-ai-response.validation';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly cache: AiCacheService,
    private readonly usage: AiUsageService,
    private readonly observability: AiObservabilityService,
    private readonly generateSessions: AiGenerateSessionService,
  ) {}

  getUsageAndDiagnostics(): AiUsageAndMetricsResponseDto {
    const u = this.usage.snapshot();
    const cache = this.observability.cacheStats();
    return {
      totalRequests: u.totalRequests,
      requestsByEndpoint: u.requestsByEndpoint,
      approximateTotalTokens: u.approximateTotalTokens,
      diagnostics: {
        uptimeSec: this.observability.uptimeSec(),
        averageLatencyMsByEndpoint:
          this.observability.averageLatencyMsByEndpoint(),
        summarizeCache: cache.summarize,
        translateCache: cache.translate,
      },
    };
  }

  async summarizeArticle(
    articleId: string,
    maxLength: SummaryMaxLength = SummaryMaxLength.MEDIUM,
  ): Promise<SummarizeArticleResponseDto> {
    const t0 = performance.now();
    try {
      const article = await this.prisma.article.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          title: true,
          content: true,
          updatedAt: true,
        },
      });

      if (!article) {
        throw new NotFoundError('Article not found');
      }

      const cacheKey = this.cache.summarizeKey({
        articleId: article.id,
        updatedAt: article.updatedAt.toISOString(),
        maxLength,
      });
      const cached = this.cache.get<SummarizeArticleResponseDto>(cacheKey);
      if (cached) {
        this.observability.recordCacheLookup('summarize', true);
        this.usage.record('article.summarize');
        return cached;
      }
      this.observability.recordCacheLookup('summarize', false);

      const prompt = buildSummarizeArticlePrompt(
        article.title,
        article.content,
        maxLength,
      );
      const { text: summary, totalTokenCount } =
        await this.geminiService.generateText(prompt);
      this.usage.record('article.summarize', totalTokenCount);

      const payload: SummarizeArticleResponseDto = {
        articleId: article.id,
        summary,
        originalLength: article.content.length,
        summaryLength: summary.length,
      };
      this.cache.set(cacheKey, payload);
      return payload;
    } finally {
      this.observability.recordHandlerLatency(
        'article.summarize',
        performance.now() - t0,
      );
    }
  }

  async translateArticle(
    articleId: string,
    dto: TranslateArticleRequestDto,
  ): Promise<TranslateArticleResponseDto> {
    const t0 = performance.now();
    try {
      const article = await this.prisma.article.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          title: true,
          content: true,
          updatedAt: true,
        },
      });

      if (!article) {
        throw new NotFoundError('Article not found');
      }

      const cacheKey = this.cache.translateKey({
        articleId: article.id,
        updatedAt: article.updatedAt.toISOString(),
        targetLanguage: dto.targetLanguage.trim().toLowerCase(),
        sourceLanguage: dto.sourceLanguage?.trim().toLowerCase() ?? '',
      });
      const cached = this.cache.get<TranslateArticleResponseDto>(cacheKey);
      if (cached) {
        this.observability.recordCacheLookup('translate', true);
        this.usage.record('article.translate');
        return cached;
      }
      this.observability.recordCacheLookup('translate', false);

      const prompt = buildTranslateArticlePrompt(
        article.title,
        article.content,
        dto.targetLanguage.trim(),
        dto.sourceLanguage?.trim(),
      );
      const { value, totalTokenCount } =
        await this.geminiService.generateJson(prompt);
      this.usage.record('article.translate', totalTokenCount);

      const parsed = safeParseTranslate(value);
      if (!parsed) {
        throw new ServiceUnavailableException(
          'AI provider returned translation JSON that failed schema validation',
        );
      }

      const payload: TranslateArticleResponseDto = {
        articleId: article.id,
        translatedText: parsed.translatedText,
        detectedLanguage: parsed.detectedLanguage,
      };
      this.cache.set(cacheKey, payload);
      return payload;
    } finally {
      this.observability.recordHandlerLatency(
        'article.translate',
        performance.now() - t0,
      );
    }
  }

  async analyzeArticle(
    articleId: string,
    dto: AnalyzeArticleRequestDto,
  ): Promise<AnalyzeArticleResponseDto> {
    const t0 = performance.now();
    try {
      const task = dto.task ?? AnalyzeArticleTask.REVIEW;

      const article = await this.prisma.article.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          title: true,
          content: true,
        },
      });

      if (!article) {
        throw new NotFoundError('Article not found');
      }

      const prompt = buildAnalyzeArticlePrompt(
        article.title,
        article.content,
        task,
      );
      const { value, totalTokenCount } =
        await this.geminiService.generateJson(prompt);
      this.usage.record('article.analyze', totalTokenCount);

      const part = safeParseAnalyzeOrFallback(value);

      return {
        articleId: article.id,
        analysis: part.analysis,
        suggestions: part.suggestions,
        severity: part.severity,
        schemaValidated: part.schemaValid,
      };
    } finally {
      this.observability.recordHandlerLatency(
        'article.analyze',
        performance.now() - t0,
      );
    }
  }

  async generate(dto: GenerateAiRequestDto): Promise<GenerateAiResponseDto> {
    const t0 = performance.now();
    try {
      if (dto.resetContext && dto.sessionId) {
        this.generateSessions.clear(dto.sessionId);
      }

      const sessionId = this.generateSessions.ensureSessionId(dto.sessionId);
      const userBubble = buildGenericGeneratePrompt(
        dto.prompt,
        dto.systemInstruction,
      );

      const prior = this.generateSessions.getPriorContents(sessionId);
      const contents = [
        ...prior,
        { role: 'user', parts: [{ text: userBubble }] },
      ];

      const { text, totalTokenCount } =
        await this.geminiService.generateTextFromContents(contents, {
          maxOutputTokens: dto.maxOutputTokens ?? 2048,
        });
      this.usage.record('generate', totalTokenCount);

      this.generateSessions.appendExchange(sessionId, userBubble, text);

      return { text, sessionId };
    } finally {
      this.observability.recordHandlerLatency(
        'generate',
        performance.now() - t0,
      );
    }
  }
}
