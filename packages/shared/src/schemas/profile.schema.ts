import { z } from 'zod';
import { ValidationMessage } from './auth.schema';

/**
 * Schema 4 bước hồ sơ ứng viên (mục 5.6 của đặc tả). Mỗi bước một `PUT`, gửi đủ dữ liệu của bước
 * đó (thay toàn bộ). Frontend dùng cùng schema để validate từng bước form trước khi gửi.
 */

/** Tháng-năm `YYYY-MM` (vd 2024-09). So sánh chuỗi cũng đúng thứ tự thời gian. */
export const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** Rỗng hoặc chỉ khoảng trắng thì coi như không có (null). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullish();

/** Kết thúc không được trước bắt đầu; thiếu một trong hai thì bỏ qua (vd đang học). */
function endNotBeforeStart(
  value: { startDate?: string | null; endDate?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      params: { i18n: ValidationMessage.END_BEFORE_START },
    });
  }
}

/** Số điện thoại Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx, cho phép dấu cách, chấm, gạch. */
const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ''))
  .refine((value) => value === '' || /^(\+84|0)\d{9,10}$/.test(value), {
    params: { i18n: ValidationMessage.PHONE_INVALID },
  })
  .transform((value) => value || null)
  .nullish();

/** Bước 1: thông tin cơ bản. */
export const basicProfileSchema = z.object({
  headline: z.string().trim().min(2).max(150),
  phone: phoneSchema,
  /** `YYYY-MM-DD`, phải trước hôm nay. */
  dateOfBirth: z.iso
    .date()
    .refine((value) => new Date(value).getTime() < Date.now(), {
      params: { i18n: ValidationMessage.DATE_IN_PAST },
    })
    .nullish(),
  locationId: z.uuid().nullish(),
  about: optionalText(3000),
  links: z
    .array(z.object({ label: z.string().trim().min(1).max(50), url: z.url().max(500) }))
    .max(5)
    .default([]),
});
export type BasicProfileInput = z.infer<typeof basicProfileSchema>;

export const educationItemSchema = z
  .object({
    school: z.string().trim().min(2).max(200),
    major: optionalText(200),
    degree: optionalText(100),
    startDate: yearMonthSchema,
    /** null: đang học. */
    endDate: yearMonthSchema.nullish(),
    /** Thang 4. */
    gpa: z.number().min(0).max(4).nullish(),
  })
  .superRefine(endNotBeforeStart);
export type EducationItemInput = z.infer<typeof educationItemSchema>;

/** Bước 2: học vấn, ít nhất 1 dòng. */
export const educationStepSchema = z.object({
  items: z.array(educationItemSchema).min(1).max(10),
});
export type EducationStepInput = z.infer<typeof educationStepSchema>;

export const candidateSkillInputSchema = z.object({
  skillId: z.uuid(),
  /** Tự đánh giá 1 (mới học) đến 5 (thành thạo). */
  level: z.number().int().min(1).max(5),
});

/** Bước 3: kỹ năng, ít nhất 1, không trùng. Dùng để tính độ khớp với tin. */
export const skillsStepSchema = z.object({
  items: z
    .array(candidateSkillInputSchema)
    .min(1)
    .max(30)
    .refine((items) => new Set(items.map((item) => item.skillId)).size === items.length, {
      params: { i18n: ValidationMessage.DUPLICATE_SKILL },
    }),
});
export type SkillsStepInput = z.infer<typeof skillsStepSchema>;

export const projectItemSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    role: optionalText(100),
    description: optionalText(3000),
    techStack: z.array(z.string().trim().min(1).max(50)).max(15).default([]),
    url: z.url().max(500).nullish(),
    startDate: yearMonthSchema.nullish(),
    endDate: yearMonthSchema.nullish(),
  })
  .superRefine(endNotBeforeStart);
export type ProjectItemInput = z.infer<typeof projectItemSchema>;

/** Bước 4: dự án, không bắt buộc; gửi mảng rỗng vẫn tính là đã xong bước này. */
export const projectsStepSchema = z.object({
  items: z.array(projectItemSchema).max(10),
});
export type ProjectsStepInput = z.infer<typeof projectsStepSchema>;
