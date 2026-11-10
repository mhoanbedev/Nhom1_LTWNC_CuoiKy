import { LOCALES, type Locale, type SeoPageType, type SitemapEntry } from '@ltwnc/shared';

/** Một dòng join bản ghi (tin/công ty) với một bản dịch của nó. */
export interface TranslationRow {
  id: string;
  updatedAt: Date;
  locale: Locale;
  slug: string;
  translationUpdatedAt: Date;
}

/** `vi` trước, `en` sau (thứ tự trong LOCALES). */
const localeOrder = (locale: Locale) => LOCALES.indexOf(locale);

/**
 * Gom các dòng (mỗi bản dịch một dòng) thành mỗi trang một phần tử, giữ thứ tự xuất hiện của trang.
 * `updatedAt` là mốc mới nhất giữa bản ghi và các bản dịch: sửa riêng bản en cũng đổi `lastmod`.
 */
export function toSitemapEntries(type: SeoPageType, rows: TranslationRow[]): SitemapEntry[] {
  const entries = new Map<string, { updatedAt: Date; alternates: SitemapEntry['alternates'] }>();
  for (const row of rows) {
    const entry = entries.get(row.id) ?? { updatedAt: row.updatedAt, alternates: [] };
    if (row.translationUpdatedAt > entry.updatedAt) entry.updatedAt = row.translationUpdatedAt;
    entry.alternates.push({ locale: row.locale, slug: row.slug });
    entries.set(row.id, entry);
  }
  return [...entries].map(([id, entry]) => ({
    type,
    id,
    updatedAt: entry.updatedAt.toISOString(),
    alternates: entry.alternates.sort((a, b) => localeOrder(a.locale) - localeOrder(b.locale)),
  }));
}
