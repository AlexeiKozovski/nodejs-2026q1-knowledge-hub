import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../types';

function createExecutionContext(role?: UserRole) {
  const request: { user?: { userId: string; login: string; role: UserRole } } =
    {};
  if (role) {
    request.user = {
      userId: 'u1',
      login: 'user1',
      role,
    };
  }

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: vi.fn(),
    getClass: vi.fn(),
  };

  return { context };
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    reflector = {
      getAllAndOverride: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: Reflector, useValue: reflector },
        {
          provide: RolesGuard,
          useFactory: (r: Reflector) => new RolesGuard(r),
          inject: [Reflector],
        },
      ],
    }).compile();

    guard = moduleRef.get(RolesGuard);
  });

  test('grants access when user has required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const { context } = createExecutionContext(UserRole.ADMIN);

    expect(guard.canActivate(context as never)).toBe(true);
  });

  test('throws ForbiddenException when user role is insufficient', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const { context } = createExecutionContext(UserRole.VIEWER);

    expect(() => guard.canActivate(context as never)).toThrowError(
      ForbiddenException,
    );
  });

  test('throws ForbiddenException when required role exists but request has no user', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const { context } = createExecutionContext();

    expect(() => guard.canActivate(context as never)).toThrowError(
      ForbiddenException,
    );
  });

  test('allows access when @Roles metadata is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const { context } = createExecutionContext();

    expect(guard.canActivate(context as never)).toBe(true);
  });
});
