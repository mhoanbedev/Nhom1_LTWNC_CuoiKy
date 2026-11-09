import { applySchema, ApplicationStatus, LOCALES, myApplicationsQuerySchema } from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class ApplyDto extends createZodDto(applySchema) {}
export class MyApplicationsQueryDto extends createZodDto(myApplicationsQuerySchema) {}

/** Chỉ để mô tả trên Swagger; kiểu thật nằm trong @ltwnc/shared (api/application.ts). */
const status = z.enum(Object.values(ApplicationStatus));
const jobSummary = z.object({
  id: z.uuid(),
  shortId: z.string(),
  locale: z.enum(LOCALES),
  slug: z.string(),
  title: z.string(),
  company: z.object({
    id: z.uuid(),
    locale: z.enum(LOCALES),
    slug: z.string(),
    name: z.string(),
    logoUrl: z.url().nullable(),
  }),
});
const listItem = z.object({
  id: z.uuid(),
  status,
  submittedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  job: jobSummary,
});

export class CandidateApplicationListItemDto extends createZodDto(listItem) {}

export class CandidateApplicationDto extends createZodDto(
  listItem.extend({
    coverLetter: z.string().nullable(),
    cv: z.object({ id: z.uuid(), originalName: z.string() }),
    history: z.array(
      z.object({
        fromStatus: status.nullable(),
        toStatus: status,
        changedBy: z.enum(['CANDIDATE', 'RECRUITER']),
        note: z.string().nullable(),
        changedAt: z.iso.datetime(),
      }),
    ),
  }),
) {}
