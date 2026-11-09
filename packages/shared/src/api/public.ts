import type { WorkMode } from '../enums/enums';
import type { Locale } from '../enums/locale';
import type { CompanySize } from '../schemas/company.schema';
import type { Currency } from '../schemas/job.schema';

/** Danh mục đã chọn tên theo ngôn ngữ (tỉnh/thành, ngành). */
export interface NamedRef {
  id: string;
  name: string;
}

export interface PublicSkill {
  id: string;
  slug: string;
  name: string;
  isRequired: boolean;
}

/** Bản ngôn ngữ đang có của một trang (để dựng hreflang). */
export interface Alternate {
  locale: Locale;
  slug: string;
}

export interface PublicCompanySummary {
  id: string;
  /** Ngôn ngữ của `name`/`slug`: theo `?lang` nếu công ty có bản đó, không thì `vi`. */
  locale: Locale;
  slug: string;
  name: string;
  logoUrl: string | null;
}

/** Một tin trong danh sách công khai (`GET /jobs`, `GET /companies/:slug/jobs`). */
export interface PublicJobListItem {
  id: string;
  shortId: string;
  /**
   * Ngôn ngữ của `title`/`slug`. Tin chỉ có bản `vi` vẫn hiện trong kết quả tiếng Anh với
   * `locale: 'vi'`, để frontend dẫn link về `/vi/...` (không có trang `/en` mang nội dung Việt).
   */
  locale: Locale;
  slug: string;
  title: string;
  company: PublicCompanySummary;
  location: NamedRef | null;
  workMode: WorkMode;
  isPaid: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: Currency;
  expiresAt: string;
  publishedAt: string | null;
  skills: PublicSkill[];
}

/**
 * Chi tiết tin công khai (`GET /jobs/:slug`): luôn đúng ngôn ngữ được yêu cầu (không có thì 404).
 * Tin đã đóng hoặc hết hạn vẫn trả 200 nhưng `seo.indexable: false`.
 */
export interface PublicJobDetail extends Omit<PublicJobListItem, 'company' | 'expiresAt'> {
  /** Slug chuẩn của ngôn ngữ này; slug trên URL khác thì frontend redirect 308. */
  canonicalSlug: string;
  alternates: Alternate[];
  description: string | null;
  /** Markdown đã render sang HTML an toàn, render thẳng được. */
  descriptionHtml: string | null;
  requirements: string | null;
  requirementsHtml: string | null;
  benefits: string | null;
  benefitsHtml: string | null;
  address: string | null;
  quantity: number;
  expiresAt: string | null;
  closedAt: string | null;
  company: PublicCompanySummary & { website: string | null };
  isAcceptingApplications: boolean;
  seo: { indexable: boolean };
}

/** Một công ty trong danh sách công khai (`GET /companies`). */
export interface PublicCompanyListItem extends PublicCompanySummary {
  industry: NamedRef | null;
  location: NamedRef | null;
  /** Số tin đang công khai. */
  openJobCount: number;
}

/** Trang công ty công khai (`GET /companies/:slug`): chỉ công ty đã duyệt, đúng ngôn ngữ (không có thì 404). */
export interface PublicCompanyDetail extends PublicCompanyListItem {
  canonicalSlug: string;
  alternates: Alternate[];
  description: string | null;
  descriptionHtml: string | null;
  website: string | null;
  size: CompanySize | null;
  address: string | null;
}
