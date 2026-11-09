import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ErrorCode } from '@ltwnc/shared';
import type { Request } from 'express';
import { AppException } from '../exceptions/app.exception';
import type { RequestUser } from '../types/request-user';

/**
 * Lấy user đã đăng nhập (gắn bởi JwtStrategy).
 * Dùng trên route có @Public thì user chưa đăng nhập sẽ nhận 401, nên route công khai
 * cần user tùy chọn phải gắn @OptionalAuth() và đọc user bằng @ViewerUser().
 *
 * @example me(@CurrentUser() user: RequestUser)
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestUser => {
    const user = context.switchToHttp().getRequest<Request>().user as RequestUser | undefined;
    if (!user) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
    return user;
  },
);
