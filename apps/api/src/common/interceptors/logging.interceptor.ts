import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

/**
 * Ghi một dòng log cho mỗi request: method, path, status, thời gian xử lý, requestId.
 * Không log body hay header để không lộ mật khẩu, token.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    // Nghe sự kiện 'finish' thay vì kết quả handler, để cả request lỗi (status do filter đặt) cũng đúng status.
    response.once('finish', () => {
      const ms = Date.now() - startedAt;
      const line = `${request.method} ${request.originalUrl} ${response.statusCode} ${ms}ms [${request.requestId}]`;
      if (response.statusCode >= 500) this.logger.error(line);
      else if (response.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });

    return next.handle();
  }
}
