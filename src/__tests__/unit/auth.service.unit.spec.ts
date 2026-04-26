import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../common/errors/domain-errors';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { UserRole as PrismaUserRole } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const bcryptMocks = vi.hoisted(() => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  hash: bcryptMocks.hash,
  compare: bcryptMocks.compare,
  default: {
    hash: bcryptMocks.hash,
    compare: bcryptMocks.compare,
  },
}));
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../../types';
import { AuthService } from '../../auth/auth.service';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: userId,
    login: 'user1',
    password: 'hashed',
    role: PrismaUserRole.VIEWER,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

function configMock() {
  return {
    get: vi.fn((key: string) => {
      const map: Record<string, string> = {
        CRYPT_SALT: '4',
        JWT_SECRET: 'access-secret-test',
        JWT_REFRESH_SECRET: 'refresh-secret-test',
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '7d',
      };
      return map[key];
    }),
  };
}

function createPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let config: ReturnType<typeof configMock>;

  beforeEach(async () => {
    bcryptMocks.hash.mockReset();
    bcryptMocks.compare.mockReset();
    prisma = createPrismaMock();
    config = configMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        {
          provide: AuthService,
          useFactory: (p: PrismaService, c: ConfigService) =>
            new AuthService(p, c),
          inject: [PrismaService, ConfigService],
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('JWT token generation', () => {
    test('returns signed access and refresh tokens on login', async () => {
      prisma.user.findUnique.mockResolvedValue(
        dbUser({ role: PrismaUserRole.EDITOR }),
      );
      bcryptMocks.compare.mockResolvedValue(true);
      const tokens = await service.login({ login: 'user1', password: 'ok' });
      const access = jwt.verify(
        tokens.accessToken,
        'access-secret-test',
      ) as jwt.JwtPayload;
      const refresh = jwt.verify(
        tokens.refreshToken,
        'refresh-secret-test',
      ) as jwt.JwtPayload;
      expect(access.userId).toBe(userId);
      expect(access.login).toBe('user1');
      expect(access.role).toBe(UserRole.EDITOR);
      expect(refresh.userId).toBe(userId);
    });
  });

  describe('token verification', () => {
    test('refresh accepts a valid refresh token and loads user from database', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser());
      const token = jwt.sign(
        { userId, login: 'user1', role: UserRole.VIEWER },
        'refresh-secret-test',
        { expiresIn: '1h' },
      );
      const next = await service.refresh({ refreshToken: token });
      expect(next.accessToken).toBeDefined();
      expect(next.refreshToken).toBeDefined();
      expect(next.refreshToken).not.toBe(token);
    });
  });

  describe('refresh token rotation', () => {
    test('rejects reuse of the same refresh token after rotation', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser());
      const first = jwt.sign(
        { userId, login: 'user1', role: UserRole.VIEWER },
        'refresh-secret-test',
        { expiresIn: '1h' },
      );
      await service.refresh({ refreshToken: first });
      await expect(
        service.refresh({ refreshToken: first }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('expired or invalid token handling', () => {
    test('throws ForbiddenError when refresh JWT is invalid', async () => {
      await expect(
        service.refresh({ refreshToken: 'not-a-jwt' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    test('throws ForbiddenError when refresh payload does not match stored user', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser({ login: 'other' }));
      const token = jwt.sign(
        { userId, login: 'user1', role: UserRole.VIEWER },
        'refresh-secret-test',
        { expiresIn: '1h' },
      );
      await expect(
        service.refresh({ refreshToken: token }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    test('throws UnauthorizedError when refresh body is malformed', async () => {
      await expect(service.refresh({})).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    });
  });

  describe('RBAC permission checks', () => {
    test('assigns ADMIN to the first signup and VIEWER to subsequent signups', async () => {
      bcryptMocks.hash.mockResolvedValue('h');
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(0);
      prisma.user.create.mockResolvedValue(
        dbUser({ role: PrismaUserRole.ADMIN }),
      );
      await service.signup({ login: 'first', password: 'p' });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: PrismaUserRole.ADMIN }),
        }),
      );
      prisma.user.count.mockResolvedValue(1);
      prisma.user.create.mockResolvedValue(
        dbUser({ role: PrismaUserRole.VIEWER }),
      );
      await service.signup({ login: 'second', password: 'p' });
      expect(prisma.user.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: PrismaUserRole.VIEWER }),
        }),
      );
    });

    test('throws ValidationError when signup login is already taken', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser());
      await expect(
        service.signup({ login: 'user1', password: 'p' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
