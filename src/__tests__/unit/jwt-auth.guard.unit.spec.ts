import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserRole } from '../../types';

function createExecutionContext(authHeader?: string) {
  const request: { headers: { authorization?: string }; user?: unknown } = {
    headers: {},
  };
  if (authHeader !== undefined) {
    request.headers.authorization = authHeader;
  }

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: vi.fn(),
    getClass: vi.fn(),
  };

  return { context, request };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let config: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    config = {
      get: vi.fn((key: string) =>
        key === 'JWT_SECRET' ? 'access-secret-test' : undefined,
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: config },
        {
          provide: JwtAuthGuard,
          useFactory: (c: ConfigService) => new JwtAuthGuard(c),
          inject: [ConfigService],
        },
      ],
    }).compile();

    guard = moduleRef.get(JwtAuthGuard);
  });

  test('passes with valid bearer token and sets request user', () => {
    const token = jwt.sign(
      { userId: 'u1', login: 'user1', role: UserRole.EDITOR },
      'access-secret-test',
      { expiresIn: '1h' },
    );
    const { context, request } = createExecutionContext(`Bearer ${token}`);

    const result = guard.canActivate(context as never);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      userId: 'u1',
      login: 'user1',
      role: UserRole.EDITOR,
    });
  });

  test('throws UnauthorizedException when authorization header is missing', () => {
    const { context } = createExecutionContext();
    expect(() => guard.canActivate(context as never)).toThrowError(
      UnauthorizedException,
    );
  });

  test('throws UnauthorizedException for malformed bearer token', () => {
    const { context } = createExecutionContext('Bearer not-a-jwt');
    expect(() => guard.canActivate(context as never)).toThrowError(
      UnauthorizedException,
    );
  });

  test('throws UnauthorizedException when bearer scheme is malformed', () => {
    const { context } = createExecutionContext('Token abc');
    expect(() => guard.canActivate(context as never)).toThrowError(
      UnauthorizedException,
    );
  });

  test('throws UnauthorizedException when bearer token is empty', () => {
    const { context } = createExecutionContext('Bearer   ');
    expect(() => guard.canActivate(context as never)).toThrowError(
      UnauthorizedException,
    );
  });

  test('throws UnauthorizedException when token payload is invalid', () => {
    const token = jwt.sign(
      { userId: 'u1', login: 'user1', role: 'UNKNOWN' },
      'access-secret-test',
    );
    const { context } = createExecutionContext(`Bearer ${token}`);
    expect(() => guard.canActivate(context as never)).toThrowError(
      UnauthorizedException,
    );
  });

  test('throws UnauthorizedException for expired token', () => {
    const token = jwt.sign(
      { userId: 'u1', login: 'user1', role: UserRole.VIEWER },
      'access-secret-test',
      { expiresIn: -1 },
    );
    const { context } = createExecutionContext(`Bearer ${token}`);
    expect(() => guard.canActivate(context as never)).toThrowError(
      UnauthorizedException,
    );
  });
});
