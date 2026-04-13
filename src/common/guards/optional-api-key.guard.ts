import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * When API_KEY is set in the environment, requests must send matching x-api-key.
 * If API_KEY is unset, all requests are allowed (local development / tests).
 */
@Injectable()
export class OptionalApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      request.path === '/' ||
      request.path === '/doc' ||
      request.path.startsWith('/doc/')
    ) {
      return true;
    }
    const requiredKey = this.configService.get<string>('API_KEY');
    if (!requiredKey) {
      return true;
    }
    const provided = request.headers['x-api-key'];
    if (provided !== requiredKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    return true;
  }
}
