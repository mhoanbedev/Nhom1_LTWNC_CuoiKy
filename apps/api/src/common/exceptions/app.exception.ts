import { HttpException } from '@nestjs/common';
import type { ApiErrorDetail, ErrorCode } from '@ltwnc/shared';
import { ERROR_HTTP_STATUS } from './error-http-status';
import type { ErrorParams } from './error-messages';

/**
 * Lỗi nghiệp vụ duy nhất được ném trong service.
 * HTTP status suy ra từ mã lỗi, nên không thể ném nhầm 400 cho lỗi 404.
 *
 * @example throw new AppException(ErrorCode.CV_LIMIT_REACHED, { max: 5 });
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    readonly params?: ErrorParams,
    readonly details?: ApiErrorDetail[],
  ) {
    super(code, ERROR_HTTP_STATUS[code]);
  }
}
