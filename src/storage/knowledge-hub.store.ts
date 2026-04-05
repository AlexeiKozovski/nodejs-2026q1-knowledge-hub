import { Injectable } from '@nestjs/common';
import { Article, ArticleStatus, Category, Comment, User } from '../types';

/**
 * In-memory store. Replace with a database-backed repository in later tasks.
 */
@Injectable()
export class KnowledgeHubStore {
  private readonly users: User[] = [];
  private readonly articles: Article[] = [];
  private readonly categories: Category[] = [];
  private readonly comments: Comment[] = [];

  getAllUsers(): User[] {
    return this.users.map((user: User) => ({ ...user }));
  }

  findUserById(id: string): User | undefined {
    const user = this.users.find((user: User) => user.id === id);
    return user ? { ...user } : undefined;
  }

  findUserByIdMutable(id: string): User | undefined {
    return this.users.find((user: User) => user.id === id);
  }

  insertUser(user: User): void {
    this.users.push(user);
  }

  updateUserRecord(id: string, patch: Partial<User>): User | undefined {
    const user = this.findUserByIdMutable(id);
    if (!user) {
      return undefined;
    }
    Object.assign(user, patch);
    return { ...user };
  }

  deleteUser(id: string): boolean {
    const index = this.users.findIndex((user: User) => user.id === id);
    if (index === -1) {
      return false;
    }
    this.users.splice(index, 1);
    this.applyUserDeleted(id);
    return true;
  }

  private applyUserDeleted(userId: string): void {
    for (const article of this.articles) {
      if (article.authorId === userId) {
        article.authorId = null;
      }
    }
    for (let i = this.comments.length - 1; i >= 0; i -= 1) {
      if (this.comments[i].authorId === userId) {
        this.comments.splice(i, 1);
      }
    }
  }

  findArticleById(id: string): Article | undefined {
    const article = this.articles.find((article: Article) => article.id === id);
    return article ? { ...article } : undefined;
  }

  findArticleByIdMutable(id: string): Article | undefined {
    return this.articles.find((article: Article) => article.id === id);
  }

  findArticles(filters: {
    status?: ArticleStatus;
    categoryId?: string;
    tag?: string;
  }): Article[] {
    return this.articles
      .filter((article: Article) => {
        if (filters.status !== undefined && article.status !== filters.status) {
          return false;
        }
        if (
          filters.categoryId !== undefined &&
          article.categoryId !== filters.categoryId
        ) {
          return false;
        }
        return !(
          filters.tag !== undefined && !article.tags.includes(filters.tag)
        );
      })
      .map((article: Article) => ({ ...article }));
  }

  insertArticle(article: Article): void {
    this.articles.push(article);
  }

  updateArticleRecord(
    id: string,
    patch: Partial<Article>,
  ): Article | undefined {
    const article = this.findArticleByIdMutable(id);
    if (!article) {
      return undefined;
    }
    Object.assign(article, patch);
    return { ...article };
  }

  deleteArticle(id: string): boolean {
    const index = this.articles.findIndex(
      (article: Article) => article.id === id,
    );
    if (index === -1) {
      return false;
    }
    this.articles.splice(index, 1);
    for (let i = this.comments.length - 1; i >= 0; i -= 1) {
      if (this.comments[i].articleId === id) {
        this.comments.splice(i, 1);
      }
    }
    return true;
  }

  getAllCategories(): Category[] {
    return this.categories.map((category: Category) => ({ ...category }));
  }

  findCategoryById(id: string): Category | undefined {
    const category = this.categories.find(
      (category: Category) => category.id === id,
    );
    return category ? { ...category } : undefined;
  }

  findCategoryByIdMutable(id: string): Category | undefined {
    return this.categories.find((category: Category) => category.id === id);
  }

  insertCategory(category: Category): void {
    this.categories.push(category);
  }

  updateCategoryRecord(
    id: string,
    patch: Partial<Category>,
  ): Category | undefined {
    const category = this.findCategoryByIdMutable(id);
    if (!category) {
      return undefined;
    }
    Object.assign(category, patch);
    return { ...category };
  }

  deleteCategory(id: string): boolean {
    const index = this.categories.findIndex(
      (category: Category) => category.id === id,
    );
    if (index === -1) {
      return false;
    }
    this.categories.splice(index, 1);
    return true;
  }
}
