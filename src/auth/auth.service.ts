import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole as PrismaUserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../types';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

type TokenPair = { accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  private readonly revokedRefreshTokens = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { login: dto.login },
    });
    if (existing) {
      throw new BadRequestException('Login is already taken');
    }
    const count = await this.prisma.user.count();
    const prismaRole =
      count === 0 ? PrismaUserRole.ADMIN : PrismaUserRole.VIEWER;
    const saltRounds = this.getSaltRounds();
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);
    const record = await this.prisma.user.create({
      data: {
        login: dto.login,
        password: passwordHash,
        role: prismaRole,
      },
    });
    return this.toPublic(record);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { login: dto.login },
    });
    if (!user) {
      throw new ForbiddenException('Invalid login or password');
    }
    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) {
      throw new ForbiddenException('Invalid login or password');
    }
    return this.issueTokens(user);
  }

  async refresh(body: unknown): Promise<TokenPair> {
    const refreshToken = this.extractRefreshToken(body);
    this.cleanupRevokedTokens();
    if (this.isRefreshTokenRevoked(refreshToken)) {
      throw new ForbiddenException('Invalid or expired refresh token');
    }
    const refreshSecret = this.getRefreshSecret();
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(refreshToken, refreshSecret) as jwt.JwtPayload;
    } catch {
      throw new ForbiddenException('Invalid or expired refresh token');
    }
    const userId = payload.userId as string | undefined;
    const login = payload.login as string | undefined;
    const role = payload.role as UserRole | undefined;
    if (!userId || !login || !this.isUserRole(role)) {
      throw new ForbiddenException('Invalid or expired refresh token');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      user.login !== login ||
      this.fromPrismaRole(user.role) !== role
    ) {
      throw new ForbiddenException('Invalid or expired refresh token');
    }
    this.revokeRefreshToken(refreshToken, payload.exp);
    return this.issueTokens(user);
  }

  async logout(body: unknown): Promise<void> {
    const refreshToken = this.extractRefreshToken(body);
    const refreshSecret = this.getRefreshSecret();
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(refreshToken, refreshSecret) as jwt.JwtPayload;
    } catch {
      throw new ForbiddenException('Invalid or expired refresh token');
    }
    this.revokeRefreshToken(refreshToken, payload.exp);
  }

  private extractRefreshToken(body: unknown): string {
    if (
      !body ||
      typeof body !== 'object' ||
      !('refreshToken' in body) ||
      typeof (body as { refreshToken: unknown }).refreshToken !== 'string'
    ) {
      throw new UnauthorizedException('Refresh token is required');
    }
    return (body as { refreshToken: string }).refreshToken;
  }

  private issueTokens(user: {
    id: string;
    login: string;
    role: PrismaUserRole;
  }): TokenPair {
    const accessSecret = this.getAccessSecret();
    const refreshSecret = this.getRefreshSecret();
    const accessTtl = this.getAccessTtl();
    const refreshTtl = this.getRefreshTtl();
    const payload = {
      userId: user.id,
      login: user.login,
      role: this.fromPrismaRole(user.role),
    };
    const accessSignOptions = { expiresIn: accessTtl } as SignOptions;
    const refreshSignOptions = { expiresIn: refreshTtl } as SignOptions;
    const accessToken = jwt.sign(payload, accessSecret, accessSignOptions);
    const refreshToken = jwt.sign(payload, refreshSecret, refreshSignOptions);
    return { accessToken, refreshToken };
  }

  private toPublic(user: {
    id: string;
    login: string;
    role: PrismaUserRole;
    createdAt: Date;
    updatedAt: Date;
  }): UserResponseDto {
    return {
      id: user.id,
      login: user.login,
      role: this.fromPrismaRole(user.role),
      createdAt: user.createdAt.getTime(),
      updatedAt: user.updatedAt.getTime(),
    };
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

  private getSaltRounds(): number {
    const raw = this.config.get<string>('CRYPT_SALT');
    const n = raw !== undefined ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(n) && n > 0 ? n : 10;
  }

  private getAccessSecret(): string {
    const secret =
      this.config.get<string>('JWT_SECRET') ??
      this.config.get<string>('JWT_SECRET_KEY');
    if (!secret) {
      throw new Error('JWT_SECRET (or JWT_SECRET_KEY) must be set');
    }
    return secret;
  }

  private getRefreshSecret(): string {
    const secret =
      this.config.get<string>('JWT_REFRESH_SECRET') ??
      this.config.get<string>('JWT_SECRET_REFRESH_KEY');
    if (!secret) {
      throw new Error(
        'JWT_REFRESH_SECRET (or JWT_SECRET_REFRESH_KEY) must be set',
      );
    }
    return secret;
  }

  private getAccessTtl(): string {
    return (
      this.config.get<string>('JWT_ACCESS_TTL') ??
      this.config.get<string>('TOKEN_EXPIRE_TIME') ??
      '15m'
    );
  }

  private getRefreshTtl(): string {
    return (
      this.config.get<string>('JWT_REFRESH_TTL') ??
      this.config.get<string>('TOKEN_REFRESH_EXPIRE_TIME') ??
      '7d'
    );
  }

  private isUserRole(value: unknown): value is UserRole {
    return (
      value === UserRole.ADMIN ||
      value === UserRole.EDITOR ||
      value === UserRole.VIEWER
    );
  }

  private revokeRefreshToken(token: string, exp?: number): void {
    const expiresAtSeconds =
      typeof exp === 'number' && Number.isFinite(exp)
        ? exp
        : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    this.revokedRefreshTokens.set(this.hashToken(token), expiresAtSeconds);
  }

  private isRefreshTokenRevoked(token: string): boolean {
    const hash = this.hashToken(token);
    const expiresAt = this.revokedRefreshTokens.get(hash);
    if (expiresAt === undefined) {
      return false;
    }
    if (expiresAt <= Math.floor(Date.now() / 1000)) {
      this.revokedRefreshTokens.delete(hash);
      return false;
    }
    return true;
  }

  private cleanupRevokedTokens(): void {
    const nowSeconds = Math.floor(Date.now() / 1000);
    for (const [hash, expiresAt] of this.revokedRefreshTokens.entries()) {
      if (expiresAt <= nowSeconds) {
        this.revokedRefreshTokens.delete(hash);
      }
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
