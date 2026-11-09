import { ErrorCode } from '@ltwnc/shared';
import { createZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';
import { AppException, ValidationFailedException } from '../exceptions/app.exception';

/**
 * Pipe validate global: mọi body, query, param có DTO tạo từ schema Zod (createZodDto).
 * Sai thì ném ValidationFailedException (400 VALIDATION_FAILED); filter dịch details theo ngôn ngữ.
 */
export const AppZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: unknown) =>
    error instanceof ZodError
      ? new ValidationFailedException(error)
      : new AppException(ErrorCode.VALIDATION_FAILED),
});
