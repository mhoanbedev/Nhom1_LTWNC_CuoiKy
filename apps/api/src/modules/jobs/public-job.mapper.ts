import type {
  Alternate,
  Locale,
  NamedRef,
  PublicCompanySummary,
  PublicJobDetail,
  PublicJobListItem,
  PublicSkill,
} from '@ltwnc/shared';
import { ErrorCode } from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { renderMarkdown } from '../../common/utils/markdown';
import type { Company } from '../companies/entities/company.entity';
import { localizedName, type LocalizedNameEntity } from '../meta/entities/localized-name.entity';
import type { Job } from './entities/job.entity';

interface HasLocale {
  locale: Locale;
}

/** Bản theo `lang` nếu có, không thì bản `vi` (luôn có). */
export function pickTranslation<T extends HasLocale>(rows: T[] | undefined, lang: Locale): T {
  const chosen =
    rows?.find((row) => row.locale === lang) ?? rows?.find((row) => row.locale === 'vi');
  if (!chosen) throw new AppException(ErrorCode.INTERNAL_ERROR);
  return chosen;
}

export function alternatesOf(rows: { locale: Locale; slug: string }[] | undefined): Alternate[] {
  return (rows ?? [])
    .map((row) => ({ locale: row.locale, slug: row.slug }))
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

export function namedRef(
  entity: (LocalizedNameEntity & { id: string }) | null | undefined,
  lang: Locale,
): NamedRef | null {
  return entity ? { id: entity.id, name: localizedName(entity, lang) } : null;
}

export function companySummary(company: Company | undefined, lang: Locale): PublicCompanySummary {
  if (!company) throw new AppException(ErrorCode.INTERNAL_ERROR);
  const translation = pickTranslation(company.translations, lang);
  return {
    id: company.id,
    locale: translation.locale,
    slug: translation.slug,
    name: translation.name,
    logoUrl: company.logoUrl,
  };
}

function skillsOf(job: Job, lang: Locale): PublicSkill[] {
  return (job.skills ?? [])
    .flatMap((row) =>
      row.skill
        ? [
            {
              id: row.skill.id,
              slug: row.skill.slug,
              name: localizedName(row.skill, lang),
              isRequired: row.isRequired,
            },
          ]
        : [],
    )
    .sort(
      (a, b) => Number(b.isRequired) - Number(a.isRequired) || a.name.localeCompare(b.name, lang),
    );
}

/** Entity (kèm translations, skills.skill, company.translations, location) → dòng danh sách. */
export function toPublicJobListItem(job: Job, lang: Locale): PublicJobListItem {
  const translation = pickTranslation(job.translations, lang);
  return {
    id: job.id,
    shortId: job.shortId,
    locale: translation.locale,
    slug: translation.slug,
    title: translation.title,
    company: companySummary(job.company, lang),
    location: namedRef(job.location, lang),
    workMode: job.workMode,
    isPaid: job.isPaid,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    currency: job.currency,
    // Tin công khai luôn có hạn (điều kiện đăng).
    expiresAt: job.expiresAt?.toISOString() ?? '',
    publishedAt: job.publishedAt?.toISOString() ?? null,
    skills: skillsOf(job, lang),
  };
}

/** Chi tiết tin ở đúng ngôn ngữ `lang` (nơi gọi đã chắc chắn tin có bản này). */
export function toPublicJobDetail(
  job: Job,
  lang: Locale,
  flags: { isPublic: boolean },
): PublicJobDetail {
  const translation = job.translations?.find((row) => row.locale === lang);
  if (!translation) throw new AppException(ErrorCode.NOT_FOUND);
  const listItem = toPublicJobListItem(job, lang);
  return {
    ...listItem,
    canonicalSlug: translation.slug,
    alternates: alternatesOf(job.translations),
    description: translation.description,
    descriptionHtml: renderMarkdown(translation.description),
    requirements: translation.requirements,
    requirementsHtml: renderMarkdown(translation.requirements),
    benefits: translation.benefits,
    benefitsHtml: renderMarkdown(translation.benefits),
    address: job.address,
    quantity: job.quantity,
    expiresAt: job.expiresAt?.toISOString() ?? null,
    closedAt: job.closedAt?.toISOString() ?? null,
    company: { ...listItem.company, website: job.company?.website ?? null },
    isAcceptingApplications: flags.isPublic,
    seo: { indexable: flags.isPublic },
  };
}
