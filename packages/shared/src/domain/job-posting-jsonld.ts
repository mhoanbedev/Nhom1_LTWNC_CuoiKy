import type { PublicJobDetail } from '../api/public';
import { WorkMode } from '../enums/enums';
import type { Locale } from '../enums/locale';

/** JSON-LD JobPosting theo schema.org, đủ trường Google cần cho Rich Results (mục 9 của đặc tả). */
export interface JobPostingJsonLd {
  '@context': 'https://schema.org';
  '@type': 'JobPosting';
  title: string;
  /** HTML (đã làm sạch ở backend): mô tả, yêu cầu, quyền lợi ghép lại. */
  description: string;
  datePosted?: string;
  validThrough?: string;
  employmentType: 'INTERN';
  identifier: { '@type': 'PropertyValue'; name: string; value: string };
  hiringOrganization: {
    '@type': 'Organization';
    name: string;
    sameAs?: string;
    logo?: string;
  };
  /** Bỏ khi làm từ xa (REMOTE). */
  jobLocation?: {
    '@type': 'Place';
    address: {
      '@type': 'PostalAddress';
      streetAddress?: string;
      addressRegion?: string;
      addressCountry: 'VN';
    };
  };
  /** Chỉ khi làm từ xa (REMOTE). */
  jobLocationType?: 'TELECOMMUTE';
  applicantLocationRequirements?: { '@type': 'Country'; name: 'VN' };
  /** Chỉ khi có lương và ghi ít nhất một mức. */
  baseSalary?: {
    '@type': 'MonetaryAmount';
    currency: string;
    value: {
      '@type': 'QuantitativeValue';
      minValue?: number;
      maxValue?: number;
      unitText: 'MONTH';
    };
  };
  directApply: true;
  inLanguage: Locale;
  skills?: string;
}

const SECTION_HEADINGS: Record<Locale, { requirements: string; benefits: string }> = {
  vi: { requirements: 'Yêu cầu', benefits: 'Quyền lợi' },
  en: { requirements: 'Requirements', benefits: 'Benefits' },
};

/** Mô tả, yêu cầu, quyền lợi ghép thành một khối HTML; trống hết thì dùng tiêu đề (Google bắt buộc có). */
function description(job: PublicJobDetail): string {
  const headings = SECTION_HEADINGS[job.locale];
  const parts = [
    job.descriptionHtml,
    job.requirementsHtml && `<h3>${headings.requirements}</h3>${job.requirementsHtml}`,
    job.benefitsHtml && `<h3>${headings.benefits}</h3>${job.benefitsHtml}`,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join('\n') : job.title;
}

function baseSalary(job: PublicJobDetail): JobPostingJsonLd['baseSalary'] {
  if (!job.isPaid || (job.salaryMin === null && job.salaryMax === null)) return undefined;
  return {
    '@type': 'MonetaryAmount',
    currency: job.currency,
    value: {
      '@type': 'QuantitativeValue',
      ...(job.salaryMin !== null && { minValue: job.salaryMin }),
      ...(job.salaryMax !== null && { maxValue: job.salaryMax }),
      unitText: 'MONTH',
    },
  };
}

/**
 * Dựng JSON-LD JobPosting từ chi tiết tin công khai (`GET /jobs/:slug`), đúng ngôn ngữ của trang.
 * Tin không được index (đã đóng, hết hạn) trả `null`: Google phạt trang có JobPosting đã hết hạn,
 * nên frontend chỉ nhúng khi có kết quả. Nhúng bằng `serializeJsonLd`, không dùng JSON.stringify.
 */
export function buildJobPostingJsonLd(job: PublicJobDetail): JobPostingJsonLd | null {
  if (!job.seo.indexable) return null;
  const remote = job.workMode === WorkMode.REMOTE;
  const salary = baseSalary(job);
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: description(job),
    ...(job.publishedAt && { datePosted: job.publishedAt }),
    ...(job.expiresAt && { validThrough: job.expiresAt }),
    employmentType: 'INTERN',
    identifier: { '@type': 'PropertyValue', name: job.company.name, value: job.shortId },
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company.name,
      ...(job.company.website && { sameAs: job.company.website }),
      ...(job.company.logoUrl && { logo: job.company.logoUrl }),
    },
    ...(remote
      ? {
          jobLocationType: 'TELECOMMUTE' as const,
          applicantLocationRequirements: { '@type': 'Country' as const, name: 'VN' as const },
        }
      : {
          jobLocation: {
            '@type': 'Place' as const,
            address: {
              '@type': 'PostalAddress' as const,
              ...(job.address && { streetAddress: job.address }),
              ...(job.location && { addressRegion: job.location.name }),
              addressCountry: 'VN' as const,
            },
          },
        }),
    ...(salary && { baseSalary: salary }),
    directApply: true,
    inLanguage: job.locale,
    ...(job.skills.length > 0 && { skills: job.skills.map((skill) => skill.name).join(', ') }),
  };
}

/**
 * JSON để đặt trong `<script type="application/ld+json">`. Escape `<` thành `<` để nội dung
 * chứa `</script>` không đóng thẻ script sớm (XSS); JSON parse lại vẫn ra đúng ký tự.
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
