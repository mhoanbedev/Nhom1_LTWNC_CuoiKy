import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCode } from '@ltwnc/shared';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppException } from '../exceptions/app.exception';

/**
 * Guard global: mọi route cần access token hợp lệ, trừ route gắn @Public().
 * Thiếu, sai hoặc hết hạn token trả 401 AUTH_TOKEN_INVALID; tài khoản khóa trả 403 (JwtStrategy).
 * Route gắn @OptionalAuth(): có token hợp lệ thì gắn user, còn lại coi như khách.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, targets)) {
      return this.tryAuthenticate(context);
    }
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser>(error: unknown, user: TUser | false): TUser {
    // Lỗi do JwtStrategy ném (vd AppException AUTH_ACCOUNT_LOCKED) giữ nguyên.
    if (error instanceof AppException) throw error;
    if (error || !user) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
    return user;
  }

  private async tryAuthenticate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.headers.authorization) return true;
    try {
      await (super.canActivate(context) as Promise<boolean>);
    } catch {
      request.user = undefined;
    }
    return true;
  }
}
