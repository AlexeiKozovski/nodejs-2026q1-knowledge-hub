import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Article, User, UserRole } from '../types';
import { KnowledgeHubStore } from '../storage/knowledge-hub.store';
import { CreateArticleDto } from './dto/create-article.dto';
import { ArticleResponseDto } from './dto/article-response.dto';

@Injectable()
export class ArticleService {
  constructor(private readonly store: KnowledgeHubStore) {}

  findAll(): ArticleResponseDto[] {
    return this.store
      .getAllArticles()
      .map((article: Article) => this.toPublic(article));
  }

  findOne(id: string): ArticleResponseDto {
    const article = this.store.findArticleById(id);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return this.toPublic(article);
  }

  // create(dto: CreateArticleDto): ArticleResponseDto {
  //   const now = Date.now();
  //   const role = dto.role ?? UserRole.VIEWER;
  //   const record: User = {
  //     id: randomUUID(),
  //     login: dto.login,
  //     password: dto.password,
  //     role,
  //     createdAt: now,
  //     updatedAt: now,
  //   };
  //   this.store.insertUser(record);
  //   return this.toPublic(record);
  // }

  // updatePassword(id: string, dto: UpdatePasswordDto): ArticleResponseDto {
  //   const user = this.store.findUserByIdMutable(id);
  //   if (!user) {
  //     throw new NotFoundException('User not found');
  //   }
  //   if (user.password !== dto.oldPassword) {
  //     throw new ForbiddenException('Old password is incorrect');
  //   }
  //   const updatedAt = Date.now();
  //   this.store.updateUserRecord(id, {
  //     password: dto.newPassword,
  //     updatedAt,
  //   });
  //   const fresh = this.store.findUserById(id);
  //   if (!fresh) {
  //     throw new NotFoundException('User not found');
  //   }
  //   return this.toPublic(fresh);
  // }
  //
  // remove(id: string): void {
  //   const deleted = this.store.deleteUser(id);
  //   if (!deleted) {
  //     throw new NotFoundException('User not found');
  //   }
  // }

  private toPublic(article: Article): ArticleResponseDto {
    return {
      id: article.id,
      title: article.title,
      content: article.content,
      status: article.status,
      authorId: article.authorId,
      categoryId: article.categoryId,
      tags: article.tags,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }
}
