import {
  applySchema,
  ApplicationStatus,
  changeApplicationStatusSchema,
  createApplicationNoteSchema,
  LOCALES,
  myApplicationsQuerySchema,
  recruiterApplicationsQuerySchema,
} from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class ApplyDto extends createZodDto(applySchema) {}
export class MyApplicationsQueryDto extends createZodDto(myApplicationsQuerySchema) {}
export class CreateApplicationNoteDto extends createZodDto(createApplicationNoteSchema) {}
export class ChangeApplicationStatusDto extends createZodDto(changeApplicationStatusSchema) {}
export class RecruiterApplicationsQueryDto extends createZodDto(recruiterApplicationsQuerySchema) {}

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
const history = z.array(
  z.object({
    fromStatus: status.nullable(),
    toStatus: status,
    changedBy: z.enum(['CANDIDATE', 'RECRUITER']),
    note: z.string().nullable(),
    changedAt: z.iso.datetime(),
  }),
);
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
    history,
  }),
) {}

const note = z.object({
  id: z.uuid(),
  content: z.string(),
  author: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  createdAt: z.iso.datetime(),
});

export class ApplicationNoteDto extends createZodDto(note) {}

const recruiterListItem = z.object({
  id: z.uuid(),
  status,
  submittedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  candidate: z.object({
    name: z.string(),
    email: z.email(),
    avatarUrl: z.url().nullable(),
    headline: z.string().nullable(),
  }),
  cv: z.object({ id: z.uuid(), originalName: z.string() }),
});

export class RecruiterApplicationListItemDto extends createZodDto(recruiterListItem) {}

export class RecruiterApplicationDto extends createZodDto(
  recruiterListItem.extend({
    job: jobSummary,
    coverLetter: z.string().nullable(),
    profile: z
      .looseObject({})
      .meta({ description: 'Hồ sơ 4 bước lúc nộp (basic, education, skills, projects)' }),
    snapshotTakenAt: z.iso.datetime(),
    history,
    allowedTransitions: z.array(status),
    notes: z.array(note).meta({ description: 'Ghi chú nội bộ, mới nhất lên trước' }),
  }),
) {}
