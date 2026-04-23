import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Comment as PrismaComment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
      throw new NotFoundException('Comment not found');
    }
    return this.toPublic(comment);
  }

  async create(dto: CreateCommentDto): Promise<CommentResponseDto> {
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
        authorId: dto.authorId ?? null,
      },
    });
    return this.toPublic(record);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Comment not found');
    }
    await this.prisma.comment.delete({ where: { id } });
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
