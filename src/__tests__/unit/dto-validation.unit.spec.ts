import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, test } from 'vitest';
import { CreateArticleDto } from '../../article/dto/create-article.dto';
import { LoginDto } from '../../auth/dto/login.dto';
import { SignupDto } from '../../auth/dto/signup.dto';
import { UserRole } from '../../types';
import { CreateUserDto } from '../../user/dto/create-user.dto';

describe('DTO validation', () => {
  test('fails when required fields are missing', async () => {
    const signup = plainToInstance(SignupDto, {});
    const login = plainToInstance(LoginDto, {});

    const signupErrors = await validate(signup);
    const loginErrors = await validate(login);

    expect(signupErrors.length).toBeGreaterThan(0);
    expect(loginErrors.length).toBeGreaterThan(0);
  });

  test('fails for invalid enum values', async () => {
    const user = plainToInstance(CreateUserDto, {
      login: 'u',
      password: 'p',
      role: 'SUPER_ADMIN',
    });
    const article = plainToInstance(CreateArticleDto, {
      title: 't',
      content: 'c',
      status: 'REMOVED',
    });

    const userErrors = await validate(user);
    const articleErrors = await validate(article);

    expect(userErrors.length).toBeGreaterThan(0);
    expect(articleErrors.length).toBeGreaterThan(0);
  });

  test('passes for valid payloads', async () => {
    const user = plainToInstance(CreateUserDto, {
      login: 'jdoe',
      password: 'secret',
      role: UserRole.VIEWER,
    });
    const article = plainToInstance(CreateArticleDto, {
      title: 'Intro to Nest',
      content: 'Body',
      authorId: '11111111-1111-4111-8111-111111111111',
      categoryId: '22222222-2222-4222-8222-222222222222',
      tags: ['nodejs', 'nestjs'],
    });

    const userErrors = await validate(user);
    const articleErrors = await validate(article);

    expect(userErrors).toHaveLength(0);
    expect(articleErrors).toHaveLength(0);
  });
});
