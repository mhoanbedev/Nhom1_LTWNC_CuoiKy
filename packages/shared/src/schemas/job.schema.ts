import { z } from 'zod';
import { JobStatus, WorkMode } from '../enums/enums';
import { ValidationMessage } from './auth.schema';
import { paginationQuerySchema, searchQuerySchema } from './pagination.schema';

export const CURRENCIES = ['VND', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Tối đa số kỹ năng gắn vào một tin. */
export const JOB_SKILLS_MAX = 20;

const markdown = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullish();

/** Nội dung tin theo một ngôn ngữ (Markdown). Slug do server sinh từ `title` + shortId. */
export const jobTranslationInputSchema = z.object({
  title: z.string().trim().min(5).max(200),
  description: markdown(20000),
  requirements: markdown(10000),
  benefits: markdown(10000),
});
export type JobTranslationInput = z.infer<typeof jobTranslationInputSchema>;

export const jobSkillInputSchema = z.object({
  skillId: z.uuid(),
  /** true: bắt buộc (trọng số 2 khi tính độ khớp); false: ưu tiên (trọng số 1). */
  isRequired: z.boolean().default(true),
});
export type JobSkillInput = z.infer<typeof jobSkillInputSchema>;

/** Các trường của tin; tạo thì đủ, sửa (PATCH) thì gửi trường nào sửa trường đó. */
const jobFields = z.object({
  workMode: z.enum(Object.values(WorkMode)),
  isPaid: z.boolean(),
  /** Lương theo tháng; chỉ có khi `isPaid`. */
  salaryMin: z.number().int().min(0).max(1_000_000_000).nullish(),
  salaryMax: z.number().int().min(0).max(1_000_000_000).nullish(),
  currency: z.enum(CURRENCIES),
  locationId: z.uuid().nullish(),
  address: z
    .string()
    .trim()
    .max(255)
    .transform((value) => value || null)
    .nullish(),
  quantity: z.number().int().min(1).max(100),
  /** Hạn nhận đơn. Bản nháp được để trống; đăng tin thì bắt buộc và phải ở tương lai. */
  expiresAt: z.iso.datetime({ offset: true }).nullish(),
  skills: z.array(jobSkillInputSchema).max(JOB_SKILLS_MAX),
  translations: z.object({
    vi: jobTranslationInputSchema,
    en: jobTranslationInputSchema.nullish(),
  }),
});

type JobFieldsShape = Partial<z.infer<typeof jobFields>>;

/** Kiểm chéo giữa các trường (lương, kỹ năng trùng). Dùng cho cả tạo và sửa. */
function checkJob(value: JobFieldsShape, ctx: z.RefinementCtx): void {
  const { salaryMin, salaryMax, isPaid, skills } = value;
  if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
    ctx.addIssue({
      code: 'custom',
      path: ['salaryMax'],
      params: { i18n: ValidationMessage.SALARY_MIN_GREATER_THAN_MAX },
    });
  }
  if (isPaid === false && (salaryMin != null || salaryMax != null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['isPaid'],
      params: { i18n: ValidationMessage.SALARY_REQUIRES_PAID },
    });
  }
  if (skills) {
    const ids = skills.map((skill) => skill.skillId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['skills'],
        params: { i18n: ValidationMessage.DUPLICATE_SKILL },
      });
    }
  }
}

/** `POST /recruiter/jobs`: tạo tin nháp. Bản `vi` bắt buộc ngay từ đầu (để sinh slug). */
export const createJobSchema = jobFields
  .extend({
    workMode: jobFields.shape.workMode.default(WorkMode.ONSITE),
    isPaid: jobFields.shape.isPaid.default(false),
    currency: jobFields.shape.currency.default('VND'),
    quantity: jobFields.shape.quantity.default(1),
    skills: jobFields.shape.skills.default([]),
  })
  .superRefine(checkJob);
export type CreateJobInput = z.infer<typeof createJobSchema>;

/**
 * `PATCH /recruiter/jobs/:id`: gửi trường nào sửa trường đó.
 * `skills` gửi lên là thay cả danh sách; `translations` gửi lên thì như PUT (bỏ `en` là xóa bản en).
 */
export const updateJobSchema = jobFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    params: { i18n: ValidationMessage.AT_LEAST_ONE_FIELD },
  })
  .superRefine(checkJob);
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

/** `GET /recruiter/jobs`: tin của công ty mình. */
export const recruiterJobsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(Object.values(JobStatus)).optional(),
  q: searchQuerySchema,
});
export type RecruiterJobsQuery = z.infer<typeof recruiterJobsQuerySchema>;

/** `POST /recruiter/jobs/:id/reopen`: mở lại tin đã đóng bắt buộc đặt hạn mới (phải ở tương lai). */
export const reopenJobSchema = z.object({
  expiresAt: z.iso.datetime({ offset: true }),
});
export type ReopenJobInput = z.infer<typeof reopenJobSchema>;
