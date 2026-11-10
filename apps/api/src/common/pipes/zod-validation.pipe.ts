import type { PipeTransform, Type } from '@nestjs/common';
import { ErrorCode } from '@ltwnc/shared';
import { createZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';
import { AppException, ValidationFailedException } from '../exceptions/app.exception';

/**
 * Pipe validate global: mọi body, query, param có DTO tạo từ schema Zod (createZodDto).
 * Sai thì ném ValidationFailedException (400 VALIDATION_FAILED); filter dịch details theo ngôn ngữ.
 */
// Ghi kiểu tường minh: kiểu suy ra trỏ vào file nội bộ của nestjs-zod, không xuất ra .d.ts được.
export const AppZodValidationPipe: Type<PipeTransform> = createZodValidationPipe({
  createValidationException: (error: unknown) =>
    error instanceof ZodError
      ? new ValidationFailedException(error)
      : new AppException(ErrorCode.VALIDATION_FAILED),
});
