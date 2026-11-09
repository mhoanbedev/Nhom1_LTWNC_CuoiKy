import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, type UserRole } from '@ltwnc/shared';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppException } from '../exceptions/app.exception';
import type { RequestUser } from '../types/request-user';

/**
 * Guard global chạy sau JwtAuthGuard: route có @Roles(...) chỉ cho vai trò liệt kê, sai thì 403.
 * Đây là lớp 1; quyền sở hữu (công ty mình, đơn của mình) kiểm lại trong service.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const user = context.switchToHttp().getRequest<Request>().user as RequestUser | undefined;
    if (!user || !roles.includes(user.role)) throw new AppException(ErrorCode.FORBIDDEN);
    return true;
  }
}
