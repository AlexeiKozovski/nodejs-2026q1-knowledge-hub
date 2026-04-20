import { PrismaClient, ArticleStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.comment.deleteMany();
  await prisma.article.deleteMany();
  await prisma.category.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();

  const saltRounds = 10;
  const [adminPassword, editorPassword] = await Promise.all([
    bcrypt.hash('admin123', saltRounds),
    bcrypt.hash('editor123', saltRounds),
  ]);

  const [admin, editor] = await Promise.all([
    prisma.user.create({
      data: {
        login: 'admin',
        password: adminPassword,
        role: UserRole.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        login: 'editor',
        password: editorPassword,
        role: UserRole.EDITOR,
      },
    }),
  ]);

  const [backend, frontend, devops] = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Backend',
        description: 'Server-side engineering and APIs',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Frontend',
        description: 'Client-side development and UI',
      },
    }),
    prisma.category.create({
      data: {
        name: 'DevOps',
        description: 'Infrastructure, CI/CD, and deployment',
      },
    }),
  ]);

  const tagNames = ['nestjs', 'postgres', 'prisma', 'docker', 'typescript'];
  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.tag.create({
        data: { name },
      }),
    ),
  );

  const byName = new Map(tags.map((tag) => [tag.name, tag.id]));

  const articles = await Promise.all([
    prisma.article.create({
      data: {
        title: 'Getting Started with NestJS',
        content: 'NestJS basics and project setup.',
        status: ArticleStatus.PUBLISHED,
        authorId: admin.id,
        categoryId: backend.id,
        tags: {
          connect: [{ id: byName.get('nestjs')! }, { id: byName.get('typescript')! }],
        },
      },
    }),
    prisma.article.create({
      data: {
        title: 'Prisma and PostgreSQL Integration',
        content: 'How to model data with Prisma ORM.',
        status: ArticleStatus.DRAFT,
        authorId: editor.id,
        categoryId: backend.id,
        tags: {
          connect: [{ id: byName.get('prisma')! }, { id: byName.get('postgres')! }],
        },
      },
    }),
    prisma.article.create({
      data: {
        title: 'Docker for Node.js Services',
        content: 'Containerizing backend applications.',
        status: ArticleStatus.PUBLISHED,
        authorId: admin.id,
        categoryId: devops.id,
        tags: {
          connect: [{ id: byName.get('docker')! }, { id: byName.get('typescript')! }],
        },
      },
    }),
    prisma.article.create({
      data: {
        title: 'Building Reliable CI Pipelines',
        content: 'Practical CI tips for teams.',
        status: ArticleStatus.ARCHIVED,
        authorId: editor.id,
        categoryId: devops.id,
        tags: {
          connect: [{ id: byName.get('docker')! }, { id: byName.get('nestjs')! }],
        },
      },
    }),
    prisma.article.create({
      data: {
        title: 'Frontend-Backend Contract Guidelines',
        content: 'API contract strategy for teams.',
        status: ArticleStatus.DRAFT,
        authorId: admin.id,
        categoryId: frontend.id,
        tags: {
          connect: [{ id: byName.get('typescript')! }, { id: byName.get('postgres')! }],
        },
      },
    }),
  ]);

  await Promise.all([
    prisma.comment.create({
      data: {
        content: 'Great introduction, very clear!',
        authorId: editor.id,
        articleId: articles[0].id,
      },
    }),
    prisma.comment.create({
      data: {
        content: 'Please add migration examples.',
        authorId: admin.id,
        articleId: articles[1].id,
      },
    }),
    prisma.comment.create({
      data: {
        content: 'This helped fix our pipeline setup.',
        authorId: editor.id,
        articleId: articles[3].id,
      },
    }),
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
