import type { ApiErrorDetail, Locale } from '@ltwnc/shared';
import { z, type ZodError } from 'zod';

type ZodErrorMap = z.core.$ZodErrorMap;
type RawIssue = Parameters<ZodErrorMap>[0];

/** Bộ câu báo lỗi có sẵn của Zod cho từng ngôn ngữ của dự án. */
const ZOD_LOCALES: Record<Locale, ZodErrorMap> = {
  vi: z.locales.vi().localeError,
  en: z.locales.en().localeError,
};

/** Dịch khóa lỗi tự đặt (vd PASSWORD_LETTER_AND_DIGIT) theo src/i18n/<lang>/validation.json. */
export type TranslateValidationKey = (key: string) => string;

/** Khóa dịch của lỗi `refine` tự đặt trong schema: `{ params: { i18n: 'KHOA' } }`. */
function customI18nKey(issue: z.core.$ZodIssue): string | undefined {
  if (issue.code !== 'custom') return undefined;
  const key: unknown = issue.params?.i18n;
  return typeof key === 'string' ? key : undefined;
}

/**
 * Đổi lỗi Zod thành `details: [{ field, message }]` theo ngôn ngữ của request.
 * Pipe chưa biết request dùng ngôn ngữ nào nên giữ ZodError gốc; filter dịch ở đây.
 */
export function zodIssuesToDetails(
  error: ZodError,
  locale: Locale,
  translateKey?: TranslateValidationKey,
): ApiErrorDetail[] {
  const errorMap = ZOD_LOCALES[locale];
  return error.issues.map((issue) => {
    const field = issue.path.map(String).join('.') || '(body)';

    const key = customI18nKey(issue);
    if (key && translateKey) return { field, message: translateKey(key) };

    // Issue đã hoàn tất vẫn giữ đủ trường (code, expected, minimum...) mà errorMap cần đọc.
    const localized = errorMap(issue as unknown as RawIssue);
    const message =
      typeof localized === 'string' ? localized : (localized?.message ?? issue.message);
    return { field, message };
  });
}
