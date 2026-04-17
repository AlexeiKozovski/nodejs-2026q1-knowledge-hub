import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CommentService } from './comment.service';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { FindCommentsQueryDto } from './dto/find-comments-query.dto';

@ApiTags('comments')
@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get()
  @ApiOperation({ summary: 'Get all comments for an article' })
  @ApiQuery({
    name: 'articleId',
    required: true,
    type: String,
    description: 'UUID v4 of the article',
  })
  @ApiOkResponse({ type: CommentResponseDto, isArray: true })
  @ApiBadRequestResponse({
    description: 'articleId missing or not a valid UUID v4',
  })
  findAll(@Query() query: FindCommentsQueryDto): Promise<CommentResponseDto[]> {
    return this.commentService.findAllForArticle(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get comment by id' })
  @ApiOkResponse({ type: CommentResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid comment id (not a UUID v4)',
  })
  @ApiNotFoundResponse({ description: 'Comment not found' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<CommentResponseDto> {
    return this.commentService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new comment' })
  @ApiCreatedResponse({ type: CommentResponseDto })
  @ApiBadRequestResponse({ description: 'Required fields missing or invalid' })
  @ApiUnprocessableEntityResponse({
    description: 'articleId does not reference an existing article',
  })
  create(@Body() dto: CreateCommentDto): Promise<CommentResponseDto> {
    return this.commentService.create(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete comment' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({
    description: 'Invalid comment id (not a UUID v4)',
  })
  @ApiNotFoundResponse({ description: 'Comment not found' })
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.commentService.remove(id);
  }
}
