import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedUser } from '../../auth/authenticated-user';
import { UserRole } from '../../types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    const header = request.headers.authorization;
    if (!header) {
      throw new UnauthorizedException('Authorization header is missing');
    }
    if (!header.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Authorization header must use Bearer scheme',
      );
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Access token is missing');
    }
    const secret =
      this.config.get<string>('JWT_SECRET') ??
      this.config.get<string>('JWT_SECRET_KEY');
    if (!secret) {
      throw new Error('JWT_SECRET (or JWT_SECRET_KEY) must be set');
    }
    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
        userId?: string;
        login?: string;
        role?: string;
      };
      const userId = payload.userId;
      const login = payload.login;
      const role = payload.role;
      if (
        typeof userId !== 'string' ||
        typeof login !== 'string' ||
        !this.isUserRole(role)
      ) {
        throw new UnauthorizedException('Access token payload is invalid');
      }
      request.user = { userId, login, role };
      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('Access token has expired');
      }
      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException('Access token is invalid');
      }
      throw new UnauthorizedException('Access token validation failed');
    }
  }

  private isUserRole(value: unknown): value is UserRole {
    return (
      value === UserRole.ADMIN ||
      value === UserRole.EDITOR ||
      value === UserRole.VIEWER
    );
  }
}
