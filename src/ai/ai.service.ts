import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../common/errors/domain-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  SummarizeArticleResponseDto,
  SummaryMaxLength,
} from './dto/summarize-article.dto';
import { GeminiService } from './gemini.service';
import { buildSummarizeArticlePrompt } from './prompts/summarize.prompt';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
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
      },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    const prompt = buildSummarizeArticlePrompt(
      article.title,
      article.content,
      maxLength,
    );
    const summary = await this.geminiService.generateText(prompt);

    return {
      articleId: article.id,
      summary,
      originalLength: article.content.length,
      summaryLength: summary.length,
    };
  }
}
