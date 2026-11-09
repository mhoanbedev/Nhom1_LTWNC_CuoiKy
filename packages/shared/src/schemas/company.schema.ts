import { z } from 'zod';
import { emailSchema, passwordSchema, personNameSchema } from './auth.schema';

/** Quy mô công ty (số nhân viên). Frontend dịch nhãn theo mã. */
export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

/** Nội dung theo một ngôn ngữ. Slug do server sinh từ `name` lúc tạo bản dịch, không gửi lên. */
export const companyTranslationInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  /** Markdown. */
  description: z.string().trim().max(10000).optional(),
});
export type CompanyTranslationInput = z.infer<typeof companyTranslationInputSchema>;

/** Rỗng hoặc chỉ khoảng trắng thì coi như không có (null). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullish();

/**
 * Thông tin công ty, dùng khi đăng ký nhà tuyển dụng và `PUT /recruiter/company`.
 * PUT gửi đầy đủ: bỏ `en` (hoặc `en: null`) là xóa bản tiếng Anh.
 */
export const companyInfoSchema = z.object({
  website: z.url().max(255).nullish(),
  size: z.enum(COMPANY_SIZES).nullish(),
  industryId: z.uuid().nullish(),
  locationId: z.uuid().nullish(),
  address: optionalText(255),
  translations: z.object({
    vi: companyTranslationInputSchema,
    en: companyTranslationInputSchema.nullish(),
  }),
});
export type CompanyInfoInput = z.infer<typeof companyInfoSchema>;

export const registerRecruiterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: personNameSchema,
  company: companyInfoSchema,
});
export type RegisterRecruiterInput = z.infer<typeof registerRecruiterSchema>;
