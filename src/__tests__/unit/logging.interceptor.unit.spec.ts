import { CallHandler, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: LoggingInterceptor,
          useFactory: () => new LoggingInterceptor(),
        },
      ],
    }).compile();
    interceptor = moduleRef.get(LoggingInterceptor);
  });

  test('passes response through and logs request timing', async () => {
    const loggerSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/users',
        }),
      }),
    };
    const next: CallHandler = {
      handle: () => of({ ok: true }),
    };

    const value = await firstValueFrom(
      interceptor.intercept(context as never, next),
    );
    expect(value).toEqual({ ok: true });
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/users \d+ms$/),
    );
  });
});
