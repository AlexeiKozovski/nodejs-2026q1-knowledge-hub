import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AiService } from './ai.service';
import {
  SummarizeArticleRequestDto,
  SummarizeArticleResponseDto,
  SummaryMaxLength,
} from './dto/summarize-article.dto';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

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
}
