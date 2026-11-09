import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorCode, type ApiError, type ApiErrorDetail } from '@ltwnc/shared';
import type { Request, Response } from 'express';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { AppException } from '../exceptions/app.exception';
import { ERROR_HTTP_STATUS } from '../exceptions/error-http-status';
import { errorMessage, type ErrorParams } from '../exceptions/error-messages';

interface ResolvedError {
  code: ErrorCode;
  status: number;
  params?: ErrorParams;
  details?: ApiErrorDetail[];
}

/** Mã lỗi Postgres: https://www.postgresql.org/docs/current/errcodes-appendix.html */
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';

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

function pgErrorCode({ driverError }: { driverError: unknown }): string | undefined {
  if (typeof driverError === 'object' && driverError !== null && 'code' in driverError) {
    return String(driverError.code);
  }
  return undefined;
}

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

  if (exception instanceof QueryFailedError) {
    const pgCode = pgErrorCode(exception);
    if (pgCode === PG_UNIQUE_VIOLATION) {
      return { code: ErrorCode.CONFLICT, status: HttpStatus.CONFLICT };
    }
    if (pgCode === PG_FOREIGN_KEY_VIOLATION) {
      return { code: ErrorCode.INVALID_REFERENCE, status: HttpStatus.BAD_REQUEST };
    }
  }

  if (exception instanceof EntityNotFoundError) {
    return { code: ErrorCode.NOT_FOUND, status: HttpStatus.NOT_FOUND };
  }

  return { code: ErrorCode.INTERNAL_ERROR, status: HttpStatus.INTERNAL_SERVER_ERROR };
}

/**
 * Exception Filter duy nhất: mọi lỗi trả cùng một format ApiError,
 * lỗi 500 ghi log kèm stack nhưng không bao giờ lộ stack ra response.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const { code, status, params, details } = resolveError(exception);

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`[${request.requestId}] ${request.method} ${request.url}`, stack);
    }

    const body: ApiError = {
      statusCode: status,
      code,
      message: errorMessage(code, params),
      details: details && details.length > 0 ? details : null,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.requestId ?? '',
    };

    response.status(status).json(body);
  }
}
