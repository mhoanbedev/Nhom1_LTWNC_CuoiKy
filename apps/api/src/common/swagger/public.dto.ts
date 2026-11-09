import {
  COMPANY_SIZES,
  companyJobsQuerySchema,
  CURRENCIES,
  LOCALES,
  publicCompaniesQuerySchema,
  publicJobsQuerySchema,
  WorkMode,
} from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class PublicJobsQueryDto extends createZodDto(publicJobsQuerySchema) {}
export class PublicCompaniesQueryDto extends createZodDto(publicCompaniesQuerySchema) {}
export class CompanyJobsQueryDto extends createZodDto(companyJobsQuerySchema) {}

/** Chỉ để mô tả trên Swagger; kiểu thật nằm trong @ltwnc/shared (api/public.ts). */
const locale = z.enum(LOCALES);
const namedRef = z.object({ id: z.uuid(), name: z.string() }).nullable();
const alternates = z.array(z.object({ locale, slug: z.string() }));
const companySummary = z.object({
  id: z.uuid(),
  locale,
  slug: z.string(),
  name: z.string(),
  logoUrl: z.url().nullable(),
});

const jobListItem = z.object({
  id: z.uuid(),
  shortId: z.string(),
  locale: locale.meta({ description: 'Ngôn ngữ của title/slug; tin chỉ có bản vi thì là vi' }),
  slug: z.string(),
  title: z.string(),
  company: companySummary,
  location: namedRef,
  workMode: z.enum(Object.values(WorkMode)),
  isPaid: z.boolean(),
  salaryMin: z.number().int().nullable(),
  salaryMax: z.number().int().nullable(),
  currency: z.enum(CURRENCIES),
  expiresAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  skills: z.array(
    z.object({ id: z.uuid(), slug: z.string(), name: z.string(), isRequired: z.boolean() }),
  ),
});

export class PublicJobListItemDto extends createZodDto(jobListItem) {}

export class SavedJobItemDto extends createZodDto(
  jobListItem.extend({ savedAt: z.iso.datetime(), isAcceptingApplications: z.boolean() }),
) {}

export class PublicJobDetailDto extends createZodDto(
  jobListItem.extend({
    canonicalSlug: z.string(),
    alternates,
    description: z.string().nullable(),
    descriptionHtml: z.string().nullable(),
    requirements: z.string().nullable(),
    requirementsHtml: z.string().nullable(),
    benefits: z.string().nullable(),
    benefitsHtml: z.string().nullable(),
    address: z.string().nullable(),
    quantity: z.number().int(),
    expiresAt: z.iso.datetime().nullable(),
    closedAt: z.iso.datetime().nullable(),
    company: companySummary.extend({ website: z.url().nullable() }),
    isAcceptingApplications: z.boolean(),
    seo: z.object({ indexable: z.boolean() }),
    isSaved: z.boolean().optional().meta({ description: 'Chỉ có khi ứng viên gửi kèm token' }),
    hasApplied: z
      .boolean()
      .optional()
      .meta({ description: 'Đã nộp đơn (kể cả đã rút); chỉ có khi ứng viên gửi kèm token' }),
  }),
) {}

const companyListItem = companySummary.extend({
  industry: namedRef,
  location: namedRef,
  openJobCount: z.number().int(),
});

export class PublicCompanyListItemDto extends createZodDto(companyListItem) {}

export class PublicCompanyDetailDto extends createZodDto(
  companyListItem.extend({
    canonicalSlug: z.string(),
    alternates,
    description: z.string().nullable(),
    descriptionHtml: z.string().nullable(),
    website: z.url().nullable(),
    size: z.enum(COMPANY_SIZES).nullable(),
    address: z.string().nullable(),
  }),
) {}
