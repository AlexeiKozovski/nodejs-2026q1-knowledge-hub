import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User, UserRole } from '../types';
import { KnowledgeHubStore } from '../storage/knowledge-hub.store';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(private readonly store: KnowledgeHubStore) {}

  findAll(): UserResponseDto[] {
    return this.store.getAllUsers().map((user) => this.toPublic(user));
  }

  findOne(id: string): UserResponseDto {
    const user = this.store.findUserById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublic(user);
  }

  create(dto: CreateUserDto): UserResponseDto {
    const now = Date.now();
    const role = dto.role ?? UserRole.VIEWER;
    const record: User = {
      id: randomUUID(),
      login: dto.login,
      password: dto.password,
      role,
      createdAt: now,
      updatedAt: now,
    };
    this.store.insertUser(record);
    return this.toPublic(record);
  }

  updatePassword(id: string, dto: UpdatePasswordDto): UserResponseDto {
    const user = this.store.findUserByIdMutable(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.password !== dto.oldPassword) {
      throw new ForbiddenException('Old password is incorrect');
    }
    const updatedAt = Date.now();
    this.store.updateUserRecord(id, {
      password: dto.newPassword,
      updatedAt,
    });
    const fresh = this.store.findUserById(id);
    if (!fresh) {
      throw new NotFoundException('User not found');
    }
    return this.toPublic(fresh);
  }

  remove(id: string): void {
    const deleted = this.store.deleteUser(id);
    if (!deleted) {
      throw new NotFoundException('User not found');
    }
  }

  private toPublic(user: User): UserResponseDto {
    return {
      id: user.id,
      login: user.login,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
