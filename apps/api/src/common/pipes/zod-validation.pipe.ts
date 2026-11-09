import { ErrorCode, type ApiErrorDetail } from '@ltwnc/shared';
import { createZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';
import { AppException } from '../exceptions/app.exception';

/** Đổi lỗi Zod thành danh sách `{ field, message }`, field dạng `education.0.school`. */
export function zodErrorToDetails(error: ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join('.') || '(body)',
    message: issue.message,
  }));
}

/**
 * Pipe validate global: mọi body, query, param có DTO tạo từ schema Zod (createZodDto).
 * Sai thì ném AppException VALIDATION_FAILED kèm details, đi chung đường với mọi lỗi khác.
 */
export const AppZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: unknown) =>
    new AppException(
      ErrorCode.VALIDATION_FAILED,
      undefined,
      error instanceof ZodError ? zodErrorToDetails(error) : undefined,
    ),
});
