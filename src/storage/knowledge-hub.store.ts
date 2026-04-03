import { Injectable } from '@nestjs/common';
import { Article, User, Comment } from '../types';

/**
 * In-memory store. Replace with a database-backed repository in later tasks.
 */
@Injectable()
export class KnowledgeHubStore {
  private readonly users: User[] = [];
  private readonly articles: Article[] = [];
  private readonly comments: Comment[] = [];

  getAllUsers(): User[] {
    return this.users.map((u) => ({ ...u }));
  }

  findUserById(id: string): User | undefined {
    const user = this.users.find((u) => u.id === id);
    return user ? { ...user } : undefined;
  }

  findUserByIdMutable(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
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
    const index = this.users.findIndex((u) => u.id === id);
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
}
