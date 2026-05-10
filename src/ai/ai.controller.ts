import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AiService } from './ai.service';
import {
  AnalyzeArticleRequestDto,
  AnalyzeArticleResponseDto,
} from './dto/analyze-article.dto';
import { AiUsageAndMetricsResponseDto } from './dto/ai-usage-metrics.dto';
import {
  GenerateAiRequestDto,
  GenerateAiResponseDto,
} from './dto/generate.dto';
import {
  SummarizeArticleRequestDto,
  SummarizeArticleResponseDto,
  SummaryMaxLength,
} from './dto/summarize-article.dto';
import {
  TranslateArticleRequestDto,
  TranslateArticleResponseDto,
} from './dto/translate-article.dto';
import { ReindexRequestDto, ReindexResponseDto } from './dto/rag-index.dto';
import {
  RagChatRequestDto,
  RagChatResponseDto,
  RagConversationHistoryResponseDto,
} from './dto/rag-chat.dto';
import {
  RagSearchRequestDto,
  RagSearchResponseDto,
} from './dto/rag-search.dto';
import { RagService } from './rag.service';

@ApiTags('ai')
@Controller('ai')
@UseGuards(ThrottlerGuard)
@Throttle({ ai: {} })
@SkipThrottle({ default: true })
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly ragService: RagService,
  ) {}

  @Get('usage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Usage counters + diagnostics (latency averages, summarize/translate cache hit ratio, uptime)',
  })
  @ApiOkResponse({ type: AiUsageAndMetricsResponseDto })
  getAiUsage(): AiUsageAndMetricsResponseDto {
    return this.aiService.getUsageAndDiagnostics();
  }

  @Post('articles/:articleId/summarize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate summary for existing article' })
  @ApiOkResponse({ type: SummarizeArticleResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiNotFoundResponse({ description: 'Article not found' })
  summarizeArticle(
    @Param('articleId', new ParseUUIDPipe({ version: '4' })) articleId: string,
    @Body() dto: SummarizeArticleRequestDto,
  ): Promise<SummarizeArticleResponseDto> {
    return this.aiService.summarizeArticle(
      articleId,
      dto.maxLength ?? SummaryMaxLength.MEDIUM,
    );
  }

  @Post('articles/:articleId/translate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Translate article content via AI' })
  @ApiOkResponse({ type: TranslateArticleResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid payload (e.g. missing targetLanguage)',
  })
  @ApiNotFoundResponse({ description: 'Article not found' })
  translateArticle(
    @Param('articleId', new ParseUUIDPipe({ version: '4' })) articleId: string,
    @Body() dto: TranslateArticleRequestDto,
  ): Promise<TranslateArticleResponseDto> {
    return this.aiService.translateArticle(articleId, dto);
  }

  @Post('articles/:articleId/analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Analyze article content (review insights)' })
  @ApiOkResponse({ type: AnalyzeArticleResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiNotFoundResponse({ description: 'Article not found' })
  analyzeArticle(
    @Param('articleId', new ParseUUIDPipe({ version: '4' })) articleId: string,
    @Body() dto: AnalyzeArticleRequestDto,
  ): Promise<AnalyzeArticleResponseDto> {
    return this.aiService.analyzeArticle(articleId, dto);
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open-ended AI generation (admin-style prompt)' })
  @ApiOkResponse({ type: GenerateAiResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  generate(@Body() dto: GenerateAiRequestDto): Promise<GenerateAiResponseDto> {
    return this.aiService.generate(dto);
  }

  @Post('rag/index')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Build or refresh vector index from Knowledge Hub articles',
  })
  @ApiOkResponse({ type: ReindexResponseDto })
  reindex(@Body() dto: ReindexRequestDto): Promise<ReindexResponseDto> {
    return this.ragService.reindex(dto);
  }

  @Post('rag/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Semantic search over indexed article chunks' })
  @ApiOkResponse({ type: RagSearchResponseDto })
  @ApiBadRequestResponse({ description: 'query is required' })
  ragSearch(@Body() dto: RagSearchRequestDto): Promise<RagSearchResponseDto> {
    return this.ragService.search(dto);
  }

  @Post('rag/chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat with Knowledge Hub RAG' })
  @ApiOkResponse({ type: RagChatResponseDto })
  @ApiBadRequestResponse({ description: 'question is required' })
  ragChat(@Body() dto: RagChatRequestDto): Promise<RagChatResponseDto> {
    return this.ragService.chat(dto);
  }

  @Delete('rag/index/articles/:articleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete all indexed vectors for one article' })
  @ApiNotFoundResponse({
    description: 'Article or index entries were not found',
  })
  deleteArticleFromRagIndex(
    @Param('articleId', new ParseUUIDPipe({ version: '4' })) articleId: string,
  ): Promise<void> {
    return this.ragService.deleteArticleFromIndex(articleId);
  }

  @Get('rag/chat/:conversationId/history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get stored RAG conversation history' })
  @ApiOkResponse({ type: RagConversationHistoryResponseDto })
  @ApiNotFoundResponse({ description: 'Conversation not found' })
  getRagConversationHistory(
    @Param('conversationId', new ParseUUIDPipe({ version: '4' }))
    conversationId: string,
  ): RagConversationHistoryResponseDto {
    return this.ragService.getConversationHistory(conversationId);
  }
}
