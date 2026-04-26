import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Comment as PrismaComment } from '@prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { ForbiddenError, NotFoundError } from '../common/errors/domain-errors';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../types';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { FindCommentsQueryDto } from './dto/find-comments-query.dto';

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForArticle(
    query: FindCommentsQueryDto,
  ): Promise<CommentResponseDto[]> {
    const comments = await this.prisma.comment.findMany({
      where: { articleId: query.articleId },
    });
    return comments.map((comment) => this.toPublic(comment));
  }

  async findOne(id: string): Promise<CommentResponseDto> {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }
    return this.toPublic(comment);
  }

  async create(
    dto: CreateCommentDto,
    actor: AuthenticatedUser,
  ): Promise<CommentResponseDto> {
    const authorId =
      actor.role === UserRole.EDITOR ? actor.userId : (dto.authorId ?? null);
    if (actor.role === UserRole.EDITOR) {
      if (dto.authorId !== undefined && dto.authorId !== actor.userId) {
        throw new ForbiddenError('Forbidden');
      }
    }
    const article = await this.prisma.article.findUnique({
      where: { id: dto.articleId },
    });
    if (!article) {
      throw new UnprocessableEntityException(
        'Referenced article does not exist',
      );
    }
    const record = await this.prisma.comment.create({
      data: {
        content: dto.content,
        articleId: dto.articleId,
        authorId,
      },
    });
    return this.toPublic(record);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Comment not found');
    }
    if (actor.role === UserRole.ADMIN) {
      await this.prisma.comment.delete({ where: { id } });
      return;
    }
    if (actor.role === UserRole.EDITOR) {
      if (existing.authorId !== actor.userId) {
        throw new ForbiddenError('Forbidden');
      }
      await this.prisma.comment.delete({ where: { id } });
      return;
    }
    throw new ForbiddenError('Forbidden');
  }

  private toPublic(comment: PrismaComment): CommentResponseDto {
    return {
      id: comment.id,
      content: comment.content,
      articleId: comment.articleId,
      authorId: comment.authorId,
      createdAt: comment.createdAt.getTime(),
    };
  }
}
