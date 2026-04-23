import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User as PrismaUser, UserRole as PrismaUserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany();
    return users.map((user) => this.toPublic(user));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublic(user);
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const record = await this.prisma.user.create({
      data: {
        login: dto.login,
        password: dto.password,
        role: this.toPrismaRole(dto.role ?? UserRole.VIEWER),
      },
    });
    return this.toPublic(record);
  }

  async updatePassword(
    id: string,
    dto: UpdatePasswordDto,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.password !== dto.oldPassword) {
      throw new ForbiddenException('Old password is incorrect');
    }
    const fresh = await this.prisma.user.update({
      where: { id },
      data: { password: dto.newPassword },
    });
    return this.toPublic(fresh);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.$transaction([
      this.prisma.article.updateMany({
        where: { authorId: id },
        data: { authorId: null },
      }),
      this.prisma.user.delete({ where: { id } }),
    ]);
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
