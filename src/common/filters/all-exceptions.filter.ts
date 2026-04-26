import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getReasonPhrase } from 'http-status-codes';
import { DomainError } from '../errors/domain-errors';
import { appendRotatingFileLine } from '../logging/log-file.writer';

function reasonPhraseOrFallback(status: number): string {
  try {
    return getReasonPhrase(status);
  } catch {
    return 'Error';
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly fileContext = AllExceptionsFilter.name;

  private writeFile(
    level: 'warn' | 'error' | 'log',
    message: string,
    trace?: string,
  ): void {
    const payload: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      context: this.fileContext,
      message,
    };
    if (trace) {
      payload.trace = trace;
    }
    appendRotatingFileLine(JSON.stringify(payload));
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      this.logHttpException(status, request, exception, body);
      const json = this.normalizeHttpBody(status, body);
      response.status(status).json(json);
      return;
    }

    if (exception instanceof DomainError) {
      const warn = `${exception.name} on ${request.method} ${request.url}: ${exception.message}`;
      this.logger.warn(warn);
      this.writeFile('warn', warn);
      response.status(exception.statusCode).json({
        statusCode: exception.statusCode,
        error: reasonPhraseOrFallback(exception.statusCode),
        message: exception.message,
      });
      return;
    }

    const err =
      exception instanceof Error ? exception : new Error(String(exception));
    const error = `${err.name} on ${request.method} ${request.url}: ${err.message}`;
    this.logger.error(error, err.stack);
    this.writeFile('error', error, err.stack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  }

  private logHttpException(
    status: number,
    request: Request,
    exception: HttpException,
    body: string | object,
  ): void {
    const summary = `${request.method} ${request.url} ${typeof body === 'string' ? body : JSON.stringify(body)}`;
    if (status >= 500) {
      const text = `HTTP ${status} ${summary}`;
      this.logger.error(text, exception.stack);
      this.writeFile('error', text, exception.stack);
    } else {
      const text = `HTTP ${status} ${summary}`;
      this.logger.warn(text);
      this.writeFile('warn', text);
    }
  }

  private normalizeHttpBody(
    status: number,
    body: string | object,
  ): Record<string, unknown> {
    if (typeof body === 'string') {
      return {
        statusCode: status,
        error: reasonPhraseOrFallback(status),
        message: body,
      };
    }
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return { ...body } as Record<string, unknown>;
    }
    return {
      statusCode: status,
      error: reasonPhraseOrFallback(status),
      message: body,
    };
  }
}
