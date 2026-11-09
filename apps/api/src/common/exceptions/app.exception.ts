import { HttpException } from '@nestjs/common';
import { ErrorCode, type ApiErrorDetail } from '@ltwnc/shared';
import type { ZodError } from 'zod';
import { ERROR_HTTP_STATUS } from './error-http-status';

/** Tham số điền vào câu báo lỗi, vd `{ max: 5 }` cho "Bạn đã có tối đa {max} CV". */
export type ErrorParams = Record<string, string | number>;

/**
 * Lỗi nghiệp vụ duy nhất được ném trong service.
 * HTTP status suy ra từ mã lỗi, nên không thể ném nhầm 400 cho lỗi 404.
 * Câu báo lỗi do filter dịch theo ngôn ngữ của request (src/i18n/<lang>/errors.json).
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

/** Lỗi validate từ pipe Zod: giữ ZodError gốc để filter dịch từng trường theo ngôn ngữ. */
export class ValidationFailedException extends AppException {
  constructor(readonly zodError: ZodError) {
    super(ErrorCode.VALIDATION_FAILED);
  }
}
