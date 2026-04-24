import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ArticleStatus as PrismaArticleStatus } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthenticatedUser } from '../../auth/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { ArticleStatus, UserRole } from '../../types';
import { CreateArticleDto } from '../../article/dto/create-article.dto';
import { FindArticlesQueryDto } from '../../article/dto/find-articles-query.dto';
import { UpdateArticleDto } from '../../article/dto/update-article.dto';
import { ArticleService } from '../../article/article.service';

const articleId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const editorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const categoryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function articleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: articleId,
    title: 'T',
    content: 'C',
    status: PrismaArticleStatus.DRAFT,
    authorId: editorId,
    categoryId,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    tags: [] as { name: string }[],
    ...overrides,
  };
}

function createPrismaMock() {
  return {
    article: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('ArticleService', () => {
  let service: ArticleService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: prisma },
        {
          provide: ArticleService,
          useFactory: (p: PrismaService) => new ArticleService(p),
          inject: [PrismaService],
        },
      ],
    }).compile();
    service = moduleRef.get(ArticleService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('article creation validation', () => {
    test('forbids editor from assigning a different authorId', async () => {
      const actor: AuthenticatedUser = {
        userId: editorId,
        login: 'ed',
        role: UserRole.EDITOR,
      };
      const dto: CreateArticleDto = {
        title: 'x',
        content: 'y',
        authorId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      };
      await expect(service.create(dto, actor)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.article.create).not.toHaveBeenCalled();
    });
  });

  describe('status transitions (draft → published → archived)', () => {
    test('maps statuses to Prisma enums on update', async () => {
      prisma.article.findUnique.mockResolvedValue(articleRow());
      prisma.article.update.mockImplementation(
        async ({ data }: { data: { status?: unknown } }) =>
          articleRow({ status: data.status }),
      );
      const actor: AuthenticatedUser = {
        userId: editorId,
        login: 'ed',
        role: UserRole.EDITOR,
      };
      await service.update(
        articleId,
        { status: ArticleStatus.PUBLISHED },
        actor,
      );
      expect(prisma.article.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PrismaArticleStatus.PUBLISHED,
          }),
        }),
      );
      prisma.article.findUnique.mockResolvedValue(
        articleRow({ status: PrismaArticleStatus.PUBLISHED }),
      );
      await service.update(
        articleId,
        { status: ArticleStatus.ARCHIVED },
        actor,
      );
      expect(prisma.article.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PrismaArticleStatus.ARCHIVED,
          }),
        }),
      );
    });
  });

  describe('invalid transitions', () => {
    test('throws BadRequestException when update payload is empty', async () => {
      prisma.article.findUnique.mockResolvedValue(articleRow());
      const actor: AuthenticatedUser = {
        userId: editorId,
        login: 'ed',
        role: UserRole.EDITOR,
      };
      await expect(
        service.update(articleId, {} as UpdateArticleDto, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    test('throws ForbiddenException when editor updates another authors article', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articleRow({ authorId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }),
      );
      const actor: AuthenticatedUser = {
        userId: editorId,
        login: 'ed',
        role: UserRole.EDITOR,
      };
      await expect(
        service.update(articleId, { title: 'nope' }, actor),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('tag management', () => {
    test('replaces tags with set and connectOrCreate on update', async () => {
      prisma.article.findUnique.mockResolvedValue(articleRow());
      prisma.article.update.mockResolvedValue(
        articleRow({ tags: [{ name: 't1' }] }),
      );
      const actor: AuthenticatedUser = {
        userId: editorId,
        login: 'ed',
        role: UserRole.EDITOR,
      };
      await service.update(articleId, { tags: ['t1'] }, actor);
      expect(prisma.article.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: {
              set: [],
              connectOrCreate: [
                { where: { name: 't1' }, create: { name: 't1' } },
              ],
            },
          }),
        }),
      );
    });
  });

  describe('filtering logic (status, categoryId, tag)', () => {
    test('builds where clause from query filters', async () => {
      prisma.article.findMany.mockResolvedValue([]);
      const q: FindArticlesQueryDto = {
        status: ArticleStatus.DRAFT,
        categoryId,
        tag: 'nodejs',
      };
      await service.findAll(q);
      expect(prisma.article.findMany).toHaveBeenCalledWith({
        where: {
          status: PrismaArticleStatus.DRAFT,
          categoryId,
          tags: { some: { name: 'nodejs' } },
        },
        include: { tags: true },
      });
    });
  });
});
