import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  DEFAULT_LOCALE,
  ErrorCode,
  isValidationMessage,
  type ApiError,
  type ApiErrorDetail,
} from '@ltwnc/shared';
import type { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { EntityNotFoundError } from 'typeorm';
import {
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
  pgErrorCode,
} from '../../database/pg-errors';
import {
  AppException,
  ValidationFailedException,
  type ErrorParams,
} from '../exceptions/app.exception';
import { ERROR_HTTP_STATUS } from '../exceptions/error-http-status';
import { zodIssuesToDetails } from '../i18n/zod-issues';

interface ResolvedError {
  code: ErrorCode;
  status: number;
  params?: ErrorParams;
  details?: ApiErrorDetail[];
}

/** Lỗi HTTP có sẵn của Nest (route không tồn tại, body JSON hỏng...) quy về mã lỗi của dự án. */
const HTTP_STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.AUTH_TOKEN_INVALID,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.FILE_TOO_LARGE,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
};

/** Quy mọi loại exception về một mã lỗi của dự án. Export để unit test. */
export function resolveError(exception: unknown): ResolvedError {
  if (exception instanceof AppException) {
    return {
      code: exception.code,
      status: exception.getStatus(),
      params: exception.params,
      details: exception.details,
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code = HTTP_STATUS_TO_CODE[status] ?? ErrorCode.INTERNAL_ERROR;
    // Mã lạ (vd 405) vẫn giữ status gốc nhưng không lộ chi tiết.
    return { code, status: HTTP_STATUS_TO_CODE[status] ? status : ERROR_HTTP_STATUS[code] };
  }

  const pgCode = pgErrorCode(exception);
  if (pgCode === PG_UNIQUE_VIOLATION) {
    return { code: ErrorCode.CONFLICT, status: HttpStatus.CONFLICT };
  }
  if (pgCode === PG_FOREIGN_KEY_VIOLATION) {
    return { code: ErrorCode.INVALID_REFERENCE, status: HttpStatus.BAD_REQUEST };
  }

  if (exception instanceof EntityNotFoundError) {
    return { code: ErrorCode.NOT_FOUND, status: HttpStatus.NOT_FOUND };
  }

  return { code: ErrorCode.INTERNAL_ERROR, status: HttpStatus.INTERNAL_SERVER_ERROR };
}

/**
 * Exception Filter duy nhất: mọi lỗi trả cùng một format ApiError, `message` và `details`
 * dịch theo ngôn ngữ của request; lỗi 500 ghi log kèm stack nhưng không lộ stack ra response.
 */
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const locale = request.locale ?? DEFAULT_LOCALE;
    const { code, status, params, details } = resolveError(exception);

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`[${request.requestId}] ${request.method} ${request.url}`, stack);
    }

    const translateKey = (key: string) => this.i18n.t(`validation.${key}`, { lang: locale });
    // Lỗi Zod dịch từ ZodError gốc; lỗi nghiệp vụ có details mà message là khóa ValidationMessage
    // (vd điều kiện đăng tin còn thiếu) thì dịch khóa đó, còn lại giữ nguyên.
    const localizedDetails =
      exception instanceof ValidationFailedException
        ? zodIssuesToDetails(exception.zodError, locale, translateKey)
        : details?.map((detail) =>
            isValidationMessage(detail.message)
              ? { field: detail.field, message: translateKey(detail.message) }
              : detail,
          );

    const body: ApiError = {
      statusCode: status,
      code,
      message: this.i18n.t(`errors.${code}`, { lang: locale, args: params }),
      details: localizedDetails && localizedDetails.length > 0 ? localizedDetails : null,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.requestId ?? '',
    };

    response.status(status).json(body);
  }
}
