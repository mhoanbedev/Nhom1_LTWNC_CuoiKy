import type { Locale } from '../enums/locale';
import type { Alternate } from './public';

/** Loại trang trong sitemap và generateStaticParams. */
export const SEO_PAGE_TYPES = ['job', 'company'] as const;
export type SeoPageType = (typeof SEO_PAGE_TYPES)[number];

/**
 * Một trang trong `GET /seo/sitemap`: tin đang công khai hoặc công ty đã duyệt. Frontend sinh một URL
 * cho mỗi phần tử của `alternates` (chỉ ngôn ngữ đã có bản dịch, `vi` đứng đầu).
 */
export interface SitemapEntry {
  type: SeoPageType;
  /** Id tin/công ty, khớp cache tag `job:{id}`, `company:{id}`. */
  id: string;
  /** Mốc sửa mới nhất của bản ghi và các bản dịch (ISO 8601), dùng làm `lastmod`. */
  updatedAt: string;
  alternates: Alternate[];
}

/** Một cặp tham số route `/[locale]/jobs/[slug]` hoặc `/[locale]/companies/[slug]`. */
export interface StaticParam {
  locale: Locale;
  slug: string;
}
