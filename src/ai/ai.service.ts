import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { NotFoundError } from '../common/errors/domain-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnalyzeArticleRequestDto,
  AnalyzeArticleResponseDto,
  AnalyzeArticleTask,
  AnalyzeSeverityDto,
} from './dto/analyze-article.dto';
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
import { GeminiService } from './gemini.service';
import { AiCacheService } from './ai-cache.service';
import { AiUsageService } from './ai-usage.service';
import { buildAnalyzeArticlePrompt } from './prompts/analyze.prompt';
import { buildGenericGeneratePrompt } from './prompts/generic-generate.prompt';
import { buildSummarizeArticlePrompt } from './prompts/summarize.prompt';
import { buildTranslateArticlePrompt } from './prompts/translate.prompt';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly cache: AiCacheService,
    private readonly usage: AiUsageService,
  ) {}

  async summarizeArticle(
    articleId: string,
    maxLength: SummaryMaxLength = SummaryMaxLength.MEDIUM,
  ): Promise<SummarizeArticleResponseDto> {
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
      this.usage.record('article.summarize');
      return cached;
    }

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
  }

  async translateArticle(
    articleId: string,
    dto: TranslateArticleRequestDto,
  ): Promise<TranslateArticleResponseDto> {
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
      this.usage.record('article.translate');
      return cached;
    }

    const prompt = buildTranslateArticlePrompt(
      article.title,
      article.content,
      dto.targetLanguage.trim(),
      dto.sourceLanguage?.trim(),
    );
    const { value, totalTokenCount } =
      await this.geminiService.generateJson(prompt);
    this.usage.record('article.translate', totalTokenCount);

    const parsed = parseTranslateJson(value);
    if (!parsed) {
      throw new ServiceUnavailableException(
        'AI provider returned malformed translation data',
      );
    }

    const payload: TranslateArticleResponseDto = {
      articleId: article.id,
      translatedText: parsed.translatedText,
      detectedLanguage: parsed.detectedLanguage,
    };
    this.cache.set(cacheKey, payload);
    return payload;
  }

  async analyzeArticle(
    articleId: string,
    dto: AnalyzeArticleRequestDto,
  ): Promise<AnalyzeArticleResponseDto> {
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

    return {
      articleId: article.id,
      ...parseAnalyzeJson(value),
    };
  }

  async generate(dto: GenerateAiRequestDto): Promise<GenerateAiResponseDto> {
    const prompt = buildGenericGeneratePrompt(
      dto.prompt,
      dto.systemInstruction,
    );
    const { text, totalTokenCount } = await this.geminiService.generateText(
      prompt,
      { maxOutputTokens: dto.maxOutputTokens ?? 2048 },
    );
    this.usage.record('generate', totalTokenCount);
    return { text };
  }
}

function parseTranslateJson(value: unknown): {
  translatedText: string;
  detectedLanguage: string;
} | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const o = value as Record<string, unknown>;
  const translatedText =
    typeof o.translatedText === 'string' ? o.translatedText.trim() : '';
  const detectedLanguage =
    typeof o.detectedLanguage === 'string'
      ? o.detectedLanguage.trim().toLowerCase()
      : '';
  if (!translatedText || !detectedLanguage) {
    return null;
  }
  return { translatedText, detectedLanguage };
}

function parseAnalyzeJson(
  value: unknown,
): Omit<AnalyzeArticleResponseDto, 'articleId'> {
  if (!value || typeof value !== 'object') {
    return {
      analysis: 'Unable to parse structured analysis from the AI response.',
      suggestions: [],
      severity: 'warning',
    };
  }
  const o = value as Record<string, unknown>;
  const analysis = typeof o.analysis === 'string' ? o.analysis.trim() : '';

  let suggestions: string[] = [];
  if (Array.isArray(o.suggestions)) {
    suggestions = o.suggestions
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const severity = normalizeSeverity(o.severity);

  return {
    analysis:
      analysis || 'No analysis text was produced for this article request.',
    suggestions,
    severity,
  };
}

function normalizeSeverity(raw: unknown): AnalyzeSeverityDto {
  if (raw === 'info' || raw === 'warning' || raw === 'error') {
    return raw;
  }
  return 'info';
}
