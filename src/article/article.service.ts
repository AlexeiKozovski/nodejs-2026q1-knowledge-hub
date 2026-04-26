import { Injectable } from '@nestjs/common';
import {
  Article as PrismaArticle,
  ArticleStatus as PrismaArticleStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../common/errors/domain-errors';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleStatus, UserRole } from '../types';
import { ArticleResponseDto } from './dto/article-response.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { FindArticlesQueryDto } from './dto/find-articles-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindArticlesQueryDto): Promise<ArticleResponseDto[]> {
    const articles = await this.prisma.article.findMany({
      where: {
        ...(query.status
          ? { status: this.toPrismaStatus(query.status) }
          : undefined),
        ...(query.categoryId ? { categoryId: query.categoryId } : undefined),
        ...(query.tag ? { tags: { some: { name: query.tag } } } : undefined),
      },
      include: {
        tags: true,
      },
    });
    return articles.map((article) => this.toPublic(article, article.tags));
  }

  async findOne(id: string): Promise<ArticleResponseDto> {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: { tags: true },
    });
    if (!article) {
      throw new NotFoundError('Article not found');
    }
    return this.toPublic(article, article.tags);
  }

  async create(
    dto: CreateArticleDto,
    actor: AuthenticatedUser,
  ): Promise<ArticleResponseDto> {
    const authorId =
      actor.role === UserRole.EDITOR ? actor.userId : (dto.authorId ?? null);
    if (actor.role === UserRole.EDITOR) {
      if (dto.authorId !== undefined && dto.authorId !== actor.userId) {
        throw new ForbiddenError('Forbidden');
      }
    }
    const record = await this.prisma.article.create({
      data: {
        title: dto.title,
        content: dto.content,
        status: this.toPrismaStatus(dto.status ?? ArticleStatus.DRAFT),
        authorId,
        categoryId: dto.categoryId ?? null,
        tags: {
          connectOrCreate: (dto.tags ?? []).map((tagName) => ({
            where: { name: tagName },
            create: { name: tagName },
          })),
        },
      },
      include: { tags: true },
    });
    return this.toPublic(record, record.tags);
  }

  async update(
    id: string,
    dto: UpdateArticleDto,
    actor: AuthenticatedUser,
  ): Promise<ArticleResponseDto> {
    const hasAnyField =
      dto.title !== undefined ||
      dto.content !== undefined ||
      dto.status !== undefined ||
      dto.authorId !== undefined ||
      dto.categoryId !== undefined ||
      dto.tags !== undefined;
    if (!hasAnyField) {
      throw new ValidationError('No fields to update');
    }

    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Article not found');
    }

    if (actor.role === UserRole.EDITOR) {
      if (existing.authorId !== actor.userId) {
        throw new ForbiddenError('Forbidden');
      }
      if (dto.authorId !== undefined && dto.authorId !== actor.userId) {
        throw new ForbiddenError('Forbidden');
      }
    }

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : undefined),
        ...(dto.content !== undefined ? { content: dto.content } : undefined),
        ...(dto.status !== undefined
          ? { status: this.toPrismaStatus(dto.status) }
          : undefined),
        ...(dto.authorId !== undefined
          ? { authorId: dto.authorId }
          : undefined),
        ...(dto.categoryId !== undefined
          ? { categoryId: dto.categoryId }
          : undefined),
        ...(dto.tags !== undefined
          ? {
              tags: {
                set: [],
                connectOrCreate: dto.tags.map((tagName) => ({
                  where: { name: tagName },
                  create: { name: tagName },
                })),
              },
            }
          : undefined),
      },
      include: { tags: true },
    });

    return this.toPublic(updated, updated.tags);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Article not found');
    }
    await this.prisma.article.delete({ where: { id } });
  }

  private toPublic(
    article: PrismaArticle,
    tags: Array<{ name: string }>,
  ): ArticleResponseDto {
    return {
      id: article.id,
      title: article.title,
      content: article.content,
      status: this.fromPrismaStatus(article.status),
      authorId: article.authorId,
      categoryId: article.categoryId,
      tags: tags.map((tag) => tag.name),
      createdAt: article.createdAt.getTime(),
      updatedAt: article.updatedAt.getTime(),
    };
  }

  private toPrismaStatus(status: ArticleStatus): PrismaArticleStatus {
    switch (status) {
      case ArticleStatus.DRAFT:
        return PrismaArticleStatus.DRAFT;
      case ArticleStatus.PUBLISHED:
        return PrismaArticleStatus.PUBLISHED;
      case ArticleStatus.ARCHIVED:
      default:
        return PrismaArticleStatus.ARCHIVED;
    }
  }

  private fromPrismaStatus(status: PrismaArticleStatus): ArticleStatus {
    switch (status) {
      case PrismaArticleStatus.DRAFT:
        return ArticleStatus.DRAFT;
      case PrismaArticleStatus.PUBLISHED:
        return ArticleStatus.PUBLISHED;
      case PrismaArticleStatus.ARCHIVED:
      default:
        return ArticleStatus.ARCHIVED;
    }
  }
}
