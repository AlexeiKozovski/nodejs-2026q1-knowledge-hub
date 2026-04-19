import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException();
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
        throw new UnauthorizedException();
      }
      request.user = { userId, login, role };
      return true;
    } catch {
      throw new UnauthorizedException();
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
