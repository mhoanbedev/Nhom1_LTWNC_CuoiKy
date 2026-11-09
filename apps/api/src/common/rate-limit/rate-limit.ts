import { applyDecorators, Injectable, UseGuards, type ExecutionContext } from '@nestjs/common';
import {
  SkipThrottle,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { ErrorCode } from '@ltwnc/shared';
import type { Response } from 'express';
import { AppException } from '../exceptions/app.exception';

/** Giới hạn theo IP, tính riêng cho từng route auth công khai. */
export const IP_THROTTLER = 'ip';
/** Giới hạn đăng nhập theo email, chặn dò mật khẩu một tài khoản dù đổi IP. */
export const EMAIL_THROTTLER = 'email';

const MINUTE_MS = 60_000;

export interface RateLimitSettings {
  authPerMinute: number;
  loginPerEmail: number;
}

/** Email trong body thô (guard chạy trước pipe validate), chuẩn hoá như emailSchema. */
function emailTracker(req: Record<string, unknown>): string {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return `email:${email}`;
}

/**
 * Hai lớp giới hạn. Auth.js gọi /auth/login từ server Next, nên mọi người dùng có thể chung
 * một IP: giới hạn theo IP để rộng (chống spam), còn chặn dò mật khẩu dựa vào giới hạn theo email.
 */
export function buildThrottlerOptions(settings: RateLimitSettings): ThrottlerModuleOptions {
  return {
    // Header mặc định của throttler có hậu tố theo tên (Retry-After-email...); tắt đi và
    // tự gửi Retry-After chuẩn trong AppThrottlerGuard.
    setHeaders: false,
    throttlers: [
      { name: IP_THROTTLER, ttl: MINUTE_MS, limit: settings.authPerMinute },
      {
        name: EMAIL_THROTTLER,
        ttl: 15 * MINUTE_MS,
        limit: settings.loginPerEmail,
        getTracker: emailTracker,
      },
    ],
  };
}

/** Vượt giới hạn: 429 TOO_MANY_REQUESTS theo format lỗi chung, kèm header Retry-After (giây). */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse<Response>();
    res.setHeader('Retry-After', String(Math.max(1, detail.timeToBlockExpire)));
    throw new AppException(ErrorCode.TOO_MANY_REQUESTS);
  }
}

/** Route auth công khai (đăng ký, refresh, Google): chỉ giới hạn theo IP. */
export const AuthRateLimit = () =>
  applyDecorators(UseGuards(AppThrottlerGuard), SkipThrottle({ [EMAIL_THROTTLER]: true }));

/** Đăng nhập bằng mật khẩu: giới hạn theo IP và theo email. */
export const LoginRateLimit = () => applyDecorators(UseGuards(AppThrottlerGuard));
