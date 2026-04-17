import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { User, UserRole } from '../types';
import { KnowledgeHubStore } from '../storage/knowledge-hub.store';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

type TokenPair = { accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly store: KnowledgeHubStore,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<UserResponseDto> {
    if (this.store.findUserByLogin(dto.login)) {
      throw new BadRequestException('Login is already taken');
    }
    const saltRounds = this.getSaltRounds();
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);
    const now = Date.now();
    const record: User = {
      id: randomUUID(),
      login: dto.login,
      password: passwordHash,
      role: UserRole.VIEWER,
      createdAt: now,
      updatedAt: now,
    };
    this.store.insertUser(record);
    return this.toPublic(record);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = this.store.findUserByLogin(dto.login);
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
    const user = this.store.findUserById(userId);
    if (!user || user.login !== login || user.role !== role) {
      throw new ForbiddenException('Invalid or expired refresh token');
    }
    return this.issueTokens(user);
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

  private issueTokens(user: User): TokenPair {
    const accessSecret = this.getAccessSecret();
    const refreshSecret = this.getRefreshSecret();
    const accessTtl = this.getAccessTtl();
    const refreshTtl = this.getRefreshTtl();
    const payload = {
      userId: user.id,
      login: user.login,
      role: user.role,
    };
    const accessSignOptions = { expiresIn: accessTtl } as SignOptions;
    const refreshSignOptions = { expiresIn: refreshTtl } as SignOptions;
    const accessToken = jwt.sign(payload, accessSecret, accessSignOptions);
    const refreshToken = jwt.sign(payload, refreshSecret, refreshSignOptions);
    return { accessToken, refreshToken };
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
}
