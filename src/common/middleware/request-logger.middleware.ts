import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const REDACTED_VALUE = '[REDACTED]';

function sanitizeLogPayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogPayload(item)) as T;
  }

  if (value && typeof value === 'object') {
    const sanitizedEntries = Object.entries(
      value as Record<string, unknown>,
    ).map(([key, nestedValue]) => {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.includes('password') ||
        normalizedKey.includes('token')
      ) {
        return [key, REDACTED_VALUE];
      }
      return [key, sanitizeLogPayload(nestedValue)];
    });
    return Object.fromEntries(sanitizedEntries) as T;
  }

  return value;
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    const { method, originalUrl, query, body } = req;
    const payload = sanitizeLogPayload({
      query: query ?? {},
      body: body ?? {},
    });
    this.logger.log(
      `Incoming request ${method} ${originalUrl} ${JSON.stringify(payload)}`,
    );

    res.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.logger.log(
        `Outgoing response ${method} ${originalUrl} ${res.statusCode} ${durationMs.toFixed(2)}ms`,
      );
    });

    next();
  }
}
