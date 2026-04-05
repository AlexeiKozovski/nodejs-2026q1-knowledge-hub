import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Comment } from '../types';
import { KnowledgeHubStore } from '../storage/knowledge-hub.store';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { FindCommentsQueryDto } from './dto/find-comments-query.dto';

@Injectable()
export class CommentService {
  constructor(private readonly store: KnowledgeHubStore) {}

  findAllForArticle(query: FindCommentsQueryDto): CommentResponseDto[] {
    return this.store
      .findCommentsByArticleId(query.articleId)
      .map((comment: Comment) => this.toPublic(comment));
  }

  findOne(id: string): CommentResponseDto {
    const comment = this.store.findCommentById(id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return this.toPublic(comment);
  }

  create(dto: CreateCommentDto): CommentResponseDto {
    const article = this.store.findArticleById(dto.articleId);
    if (!article) {
      throw new UnprocessableEntityException(
        'Referenced article does not exist',
      );
    }
    const now = Date.now();
    const record: Comment = {
      id: randomUUID(),
      content: dto.content,
      articleId: dto.articleId,
      authorId: dto.authorId ?? null,
      createdAt: now,
    };
    this.store.insertComment(record);
    return this.toPublic(record);
  }

  remove(id: string): void {
    const deleted = this.store.deleteComment(id);
    if (!deleted) {
      throw new NotFoundException('Comment not found');
    }
  }

  private toPublic(comment: Comment): CommentResponseDto {
    return {
      id: comment.id,
      content: comment.content,
      articleId: comment.articleId,
      authorId: comment.authorId,
      createdAt: comment.createdAt,
    };
  }
}
