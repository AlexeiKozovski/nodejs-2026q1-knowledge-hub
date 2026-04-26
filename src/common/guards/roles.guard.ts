import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../auth/authenticated-user';
import { UserRole } from '../../types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ForbiddenError } from '../errors/domain-errors';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenError('Forbidden');
    }
    if (!roles.includes(user.role)) {
      throw new ForbiddenError('Forbidden');
    }
    return true;
  }
}
