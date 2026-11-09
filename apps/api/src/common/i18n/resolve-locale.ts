import { DEFAULT_LOCALE, isLocale, type Locale } from '@ltwnc/shared';

/**
 * Chọn ngôn ngữ cho request (mục 3 của đặc tả):
 * 1. query `?lang=vi|en`
 * 2. header `Accept-Language` (theo trọng số q, chỉ xét phần ngôn ngữ chính: `en-US` -> `en`)
 * 3. mặc định `vi`
 */
export function resolveLocale(queryLang: unknown, acceptLanguage: string | undefined): Locale {
  const fromQuery = typeof queryLang === 'string' ? queryLang.trim().toLowerCase() : undefined;
  if (isLocale(fromQuery)) return fromQuery;

  if (acceptLanguage) {
    const candidates = acceptLanguage
      .split(',')
      .map((part, index) => {
        const [tag = '', ...params] = part.trim().split(';');
        const qParam = params.find((p) => p.trim().startsWith('q='));
        const q = qParam ? Number(qParam.trim().slice(2)) : 1;
        return { lang: tag.split('-')[0]?.toLowerCase(), q: Number.isNaN(q) ? 0 : q, index };
      })
      .filter((c) => c.q > 0)
      // q cao trước; bằng nhau thì giữ thứ tự người dùng khai.
      .sort((a, b) => b.q - a.q || a.index - b.index);

    const match = candidates.find((c) => isLocale(c.lang));
    if (match && isLocale(match.lang)) return match.lang;
  }

  return DEFAULT_LOCALE;
}
