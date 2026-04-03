import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    this.logger.log(`→ ${method} ${originalUrl}`);
    res.on('finish', () => {
      this.logger.log(`← ${method} ${originalUrl} ${res.statusCode}`);
    });
    next();
  }
}
