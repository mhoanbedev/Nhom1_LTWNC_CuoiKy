import type { ApiErrorDetail, Locale } from '@ltwnc/shared';
import { z, type ZodError } from 'zod';

type ZodErrorMap = z.core.$ZodErrorMap;
type RawIssue = Parameters<ZodErrorMap>[0];

/** Bộ câu báo lỗi có sẵn của Zod cho từng ngôn ngữ của dự án. */
const ZOD_LOCALES: Record<Locale, ZodErrorMap> = {
  vi: z.locales.vi().localeError,
  en: z.locales.en().localeError,
};

/**
 * Đổi lỗi Zod thành `details: [{ field, message }]` theo ngôn ngữ của request.
 * Pipe chưa biết request dùng ngôn ngữ nào nên giữ ZodError gốc; filter dịch ở đây.
 */
export function zodIssuesToDetails(error: ZodError, locale: Locale): ApiErrorDetail[] {
  const errorMap = ZOD_LOCALES[locale];
  return error.issues.map((issue) => {
    // Issue đã hoàn tất vẫn giữ đủ trường (code, expected, minimum...) mà errorMap cần đọc.
    const localized = errorMap(issue as unknown as RawIssue);
    const message =
      typeof localized === 'string' ? localized : (localized?.message ?? issue.message);
    return { field: issue.path.map(String).join('.') || '(body)', message };
  });
}
