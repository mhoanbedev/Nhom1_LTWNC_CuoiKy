import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface RequestClientInfo {
  userAgent: string | null;
  ip: string | null;
}

/**
 * User agent và IP của client, lưu kèm phiên đăng nhập để tra cứu.
 * Khi chạy sau proxy (Render) cần bật `trust proxy` thì `req.ip` mới là IP thật.
 */
export const ClientInfo = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestClientInfo => {
    const request = context.switchToHttp().getRequest<Request>();
    return { userAgent: request.header('user-agent') ?? null, ip: request.ip ?? null };
  },
);
