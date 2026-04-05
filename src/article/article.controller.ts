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
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ArticleStatus } from '../types';
import { ArticleService } from './article.service';
import { ArticleResponseDto } from './dto/article-response.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { FindArticlesQueryDto } from './dto/find-articles-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@ApiTags('articles')
@Controller('article')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  @ApiOperation({ summary: 'List articles (optional filters)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ArticleStatus,
  })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'tag', required: false, example: 'nodejs' })
  @ApiOkResponse({ type: ArticleResponseDto, isArray: true })
  findAll(@Query() query: FindArticlesQueryDto): ArticleResponseDto[] {
    return this.articleService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single article by id' })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid article id (not a UUID v4)' })
  @ApiNotFoundResponse({ description: 'Article not found' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ArticleResponseDto {
    return this.articleService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create article' })
  @ApiCreatedResponse({ type: ArticleResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  create(@Body() dto: CreateArticleDto): ArticleResponseDto {
    return this.articleService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update article info' })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid id or body' })
  @ApiNotFoundResponse({ description: 'Article not found' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateArticleDto,
  ): ArticleResponseDto {
    return this.articleService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete article' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({
    description: 'Invalid article id (not a UUID v4)',
  })
  @ApiNotFoundResponse({ description: 'Article not found' })
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): void {
    this.articleService.remove(id);
  }
}
