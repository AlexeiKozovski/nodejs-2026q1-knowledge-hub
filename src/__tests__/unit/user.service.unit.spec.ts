import {
  NotFoundError,
  ValidationError,
} from '../../common/errors/domain-errors';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma, UserRole as PrismaUserRole } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthenticatedUser } from '../../auth/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../../types';
import { CreateUserDto } from '../../user/dto/create-user.dto';
import { UpdateUserDto } from '../../user/dto/update-user.dto';
import { UserService } from '../../user/user.service';

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

const userId = '11111111-1111-4111-8111-111111111111';

function prismaUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: userId,
    login: 'jdoe',
    password: 'stored-hash',
    role: PrismaUserRole.VIEWER,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function createPrismaMock() {
  return {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    article: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    comment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    $transaction: vi.fn((ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
  };
}

describe('UserService', () => {
  let service: UserService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let config: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    bcryptMocks.hash.mockReset();
    bcryptMocks.compare.mockReset();
    prisma = createPrismaMock();
    config = {
      get: vi.fn((key: string) => (key === 'CRYPT_SALT' ? '4' : undefined)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        {
          provide: UserService,
          useFactory: (p: PrismaService, c: ConfigService) =>
            new UserService(p, c),
          inject: [PrismaService, ConfigService],
        },
      ],
    }).compile();
    service = moduleRef.get(UserService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('signup data validation', () => {
    test('throws ValidationError when update has no fields to change', async () => {
      const actor: AuthenticatedUser = {
        userId,
        login: 'a',
        role: UserRole.ADMIN,
      };
      const dto: UpdateUserDto = {};
      await expect(
        service.updateUser(userId, dto, actor),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    test('throws ValidationError when password change is incomplete', async () => {
      prisma.user.findUnique.mockResolvedValue(prismaUser());
      const actor: AuthenticatedUser = {
        userId,
        login: 'a',
        role: UserRole.ADMIN,
      };
      await expect(
        service.updateUser(
          userId,
          { oldPassword: 'x' } as UpdateUserDto,
          actor,
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('password hashing', () => {
    test('hashes password with salt rounds from config when creating a user', async () => {
      bcryptMocks.hash.mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(
        prismaUser({ password: 'hashed-password' }),
      );
      const dto: CreateUserDto = {
        login: 'new',
        password: 'plain',
        role: UserRole.VIEWER,
      };
      await service.create(dto);
      expect(bcryptMocks.hash).toHaveBeenCalledWith('plain', 4);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ password: 'hashed-password' }),
        }),
      );
    });
  });

  describe('role assignment', () => {
    test('persists explicit role from DTO', async () => {
      bcryptMocks.hash.mockResolvedValue('h');
      prisma.user.create.mockResolvedValue(
        prismaUser({ role: PrismaUserRole.EDITOR }),
      );
      const dto: CreateUserDto = {
        login: 'ed',
        password: 'p',
        role: UserRole.EDITOR,
      };
      await service.create(dto);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: PrismaUserRole.EDITOR }),
        }),
      );
    });

    test('defaults to VIEWER when role is omitted', async () => {
      bcryptMocks.hash.mockResolvedValue('h');
      prisma.user.create.mockResolvedValue(prismaUser());
      await service.create({ login: 'v', password: 'p' });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: PrismaUserRole.VIEWER }),
        }),
      );
    });
  });

  describe('user not found', () => {
    test('throws NotFoundError on findOne when user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const actor: AuthenticatedUser = {
        userId,
        login: 'a',
        role: UserRole.ADMIN,
      };
      await expect(service.findOne(userId, actor)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('duplicate login', () => {
    test('propagates unique constraint failure from Prisma on create', async () => {
      bcryptMocks.hash.mockResolvedValue('h');
      const err = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'test',
        },
      );
      prisma.user.create.mockRejectedValue(err);
      await expect(
        service.create({ login: 'dup', password: 'p' }),
      ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    });
  });
});
