import {
  adminJobsQuerySchema,
  createJobSchema,
  hideJobSchema,
  CURRENCIES,
  JobStatus,
  recruiterJobsQuerySchema,
  reopenJobSchema,
  updateJobSchema,
  WorkMode,
} from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class CreateJobDto extends createZodDto(createJobSchema) {}

export class UpdateJobDto extends createZodDto(updateJobSchema) {}

export class ReopenJobDto extends createZodDto(reopenJobSchema) {}

export class RecruiterJobsQueryDto extends createZodDto(recruiterJobsQuerySchema) {}

/** Chỉ để mô tả trên Swagger; kiểu thật là RecruiterJob, RecruiterJobListItem trong @ltwnc/shared. */
const translation = z.object({
  title: z.string(),
  slug: z.string().meta({ example: 'thuc-tap-backend-nodejs-a1b2c3' }),
  description: z.string().nullable(),
  requirements: z.string().nullable(),
  benefits: z.string().nullable(),
});

const status = z.enum(Object.values(JobStatus));
const datetime = z.iso.datetime().nullable();

export class RecruiterJobDto extends createZodDto(
  z.object({
    id: z.uuid(),
    shortId: z.string().meta({ example: 'a1b2c3' }),
    status,
    isHidden: z.boolean(),
    hiddenReason: z.string().nullable(),
    workMode: z.enum(Object.values(WorkMode)),
    isPaid: z.boolean(),
    salaryMin: z.number().int().nullable(),
    salaryMax: z.number().int().nullable(),
    currency: z.enum(CURRENCIES),
    locationId: z.uuid().nullable(),
    address: z.string().nullable(),
    quantity: z.number().int(),
    expiresAt: datetime,
    publishedAt: datetime,
    closedAt: datetime,
    skills: z.array(z.object({ skillId: z.uuid(), isRequired: z.boolean() })),
    translations: z.object({ vi: translation, en: translation.nullable() }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
) {}

export class RecruiterJobListItemDto extends createZodDto(
  z.object({
    id: z.uuid(),
    shortId: z.string(),
    status,
    isHidden: z.boolean(),
    title: z.string().meta({ description: 'Tiêu đề bản vi' }),
    hasEnglish: z.boolean(),
    expiresAt: datetime,
    publishedAt: datetime,
    updatedAt: z.iso.datetime(),
  }),
) {}

export class AdminJobsQueryDto extends createZodDto(adminJobsQuerySchema) {}

export class HideJobDto extends createZodDto(hideJobSchema) {}

/** Chỉ để mô tả trên Swagger; kiểu thật là AdminJob trong @ltwnc/shared. */
export class AdminJobDto extends createZodDto(
  z.object({
    id: z.uuid(),
    shortId: z.string(),
    status,
    isHidden: z.boolean(),
    hiddenReason: z.string().nullable(),
    title: z.string().meta({ description: 'Tiêu đề bản vi' }),
    titleEn: z.string().nullable(),
    company: z.object({ id: z.uuid(), name: z.string().meta({ description: 'Tên bản vi' }) }),
    expiresAt: datetime,
    publishedAt: datetime,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
) {}
