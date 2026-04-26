import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User as PrismaUser, UserRole as PrismaUserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthenticatedUser } from '../auth/authenticated-user';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../common/errors/domain-errors';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany();
    return users.map((user) => this.toPublic(user));
  }

  async findOne(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    if (actor.role === UserRole.VIEWER && actor.userId !== id) {
      throw new ForbiddenError('Forbidden');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.toPublic(user);
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const saltRounds = this.getSaltRounds();
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);
    const record = await this.prisma.user.create({
      data: {
        login: dto.login,
        password: passwordHash,
        role: this.toPrismaRole(dto.role ?? UserRole.VIEWER),
      },
    });
    return this.toPublic(record);
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const hasRole = dto.role !== undefined;
    const hasPassword =
      dto.oldPassword !== undefined || dto.newPassword !== undefined;

    if (!hasRole && !hasPassword) {
      throw new ValidationError('No fields to update');
    }
    if (hasPassword && (!dto.oldPassword || !dto.newPassword)) {
      throw new ValidationError('oldPassword and newPassword are required');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isAdmin = actor.role === UserRole.ADMIN;
    const isSelf = actor.userId === id;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenError('Forbidden');
    }

    if (hasRole) {
      if (!isAdmin) {
        throw new ForbiddenError('Forbidden');
      }
      const updated = await this.prisma.user.update({
        where: { id },
        data: { role: this.toPrismaRole(dto.role!) },
      });
      return this.toPublic(updated);
    }

    const match = await bcrypt.compare(dto.oldPassword!, user.password);
    if (!match) {
      throw new ForbiddenError('Old password is incorrect');
    }
    const passwordHash = await bcrypt.hash(
      dto.newPassword!,
      this.getSaltRounds(),
    );
    const fresh = await this.prisma.user.update({
      where: { id },
      data: { password: passwordHash },
    });
    return this.toPublic(fresh);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Forbidden');
    }
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('User not found');
    }
    await this.prisma.$transaction([
      this.prisma.article.updateMany({
        where: { authorId: id },
        data: { authorId: null },
      }),
      this.prisma.comment.deleteMany({ where: { authorId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
  }

  private getSaltRounds(): number {
    const raw = this.config.get<string>('CRYPT_SALT');
    const n = raw !== undefined ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(n) && n > 0 ? n : 10;
  }

  private toPublic(user: PrismaUser): UserResponseDto {
    return {
      id: user.id,
      login: user.login,
      role: this.fromPrismaRole(user.role),
      createdAt: user.createdAt.getTime(),
      updatedAt: user.updatedAt.getTime(),
    };
  }

  private toPrismaRole(role: UserRole): PrismaUserRole {
    switch (role) {
      case UserRole.ADMIN:
        return PrismaUserRole.ADMIN;
      case UserRole.EDITOR:
        return PrismaUserRole.EDITOR;
      case UserRole.VIEWER:
      default:
        return PrismaUserRole.VIEWER;
    }
  }

  private fromPrismaRole(role: PrismaUserRole): UserRole {
    switch (role) {
      case PrismaUserRole.ADMIN:
        return UserRole.ADMIN;
      case PrismaUserRole.EDITOR:
        return UserRole.EDITOR;
      case PrismaUserRole.VIEWER:
      default:
        return UserRole.VIEWER;
    }
  }
}
