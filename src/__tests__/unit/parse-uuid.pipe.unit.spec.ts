import {
  ArgumentMetadata,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, test } from 'vitest';

describe('ParseUUIDPipe', () => {
  let pipe: ParseUUIDPipe;
  const metadata: ArgumentMetadata = {
    type: 'param',
    data: 'id',
    metatype: String,
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: ParseUUIDPipe,
          useFactory: () => new ParseUUIDPipe({ version: '4' }),
        },
      ],
    }).compile();

    pipe = moduleRef.get(ParseUUIDPipe);
  });

  test('passes through valid UUID v4', async () => {
    const value = '11111111-1111-4111-8111-111111111111';
    await expect(pipe.transform(value, metadata)).resolves.toBe(value);
  });

  test('throws BadRequestException for invalid UUID string', async () => {
    await expect(
      pipe.transform('invalid-uuid', metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
