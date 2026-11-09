import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DEFAULT_LOCALE, type Locale } from '@ltwnc/shared';
import type { Request } from 'express';

/**
 * Lấy ngôn ngữ đã chuẩn hoá của request (`vi` | `en`).
 *
 * @example findOne(@Param('slug') slug: string, @Lang() lang: Locale)
 */
export const Lang = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Locale =>
    context.switchToHttp().getRequest<Request>().locale ?? DEFAULT_LOCALE,
);
