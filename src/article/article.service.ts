import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Article, ArticleStatus } from '../types';
import { KnowledgeHubStore } from '../storage/knowledge-hub.store';
import { ArticleResponseDto } from './dto/article-response.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { FindArticlesQueryDto } from './dto/find-articles-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticleService {
  constructor(private readonly store: KnowledgeHubStore) {}

  findAll(query: FindArticlesQueryDto): ArticleResponseDto[] {
    return this.store
      .findArticles({
        status: query.status,
        categoryId: query.categoryId,
        tag: query.tag,
      })
      .map((article: Article) => this.toPublic(article));
  }

  findOne(id: string): ArticleResponseDto {
    const article = this.store.findArticleById(id);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return this.toPublic(article);
  }

  create(dto: CreateArticleDto): ArticleResponseDto {
    const now = Date.now();
    const record: Article = {
      id: randomUUID(),
      title: dto.title,
      content: dto.content,
      status: ArticleStatus.DRAFT,
      authorId: null,
      categoryId: null,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    this.store.insertArticle(record);
    return this.toPublic(record);
  }

  update(id: string, dto: UpdateArticleDto): ArticleResponseDto {
    const patch: Partial<Article> = {};
    if (dto.title !== undefined) {
      patch.title = dto.title;
    }
    if (dto.content !== undefined) {
      patch.content = dto.content;
    }
    if (dto.status !== undefined) {
      patch.status = dto.status;
    }
    if (dto.authorId !== undefined) {
      patch.authorId = dto.authorId;
    }
    if (dto.categoryId !== undefined) {
      patch.categoryId = dto.categoryId;
    }
    if (dto.tags !== undefined) {
      patch.tags = dto.tags;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    patch.updatedAt = Date.now();
    const updated = this.store.updateArticleRecord(id, patch);
    if (!updated) {
      throw new NotFoundException('Article not found');
    }
    return this.toPublic(updated);
  }

  remove(id: string): void {
    const deleted = this.store.deleteArticle(id);
    if (!deleted) {
      throw new NotFoundException('Article not found');
    }
  }

  private toPublic(article: Article): ArticleResponseDto {
    return {
      id: article.id,
      title: article.title,
      content: article.content,
      status: article.status,
      authorId: article.authorId,
      categoryId: article.categoryId,
      tags: [...article.tags],
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }
}
