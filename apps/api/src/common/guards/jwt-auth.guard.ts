import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCode } from '@ltwnc/shared';
import type { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppException } from '../exceptions/app.exception';

/**
 * Guard global: mọi route cần access token hợp lệ, trừ route gắn @Public().
 * Thiếu, sai hoặc hết hạn token trả 401 AUTH_TOKEN_INVALID; tài khoản khóa trả 403 (JwtStrategy).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser>(error: unknown, user: TUser | false): TUser {
    // Lỗi do JwtStrategy ném (vd AppException AUTH_ACCOUNT_LOCKED) giữ nguyên.
    if (error instanceof AppException) throw error;
    if (error || !user) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
    return user;
  }
}
