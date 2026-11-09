import { z } from 'zod';

/**
 * Lỗi validate tự đặt mang `params.i18n`: API dịch theo src/i18n/<lang>/validation.json,
 * frontend dịch bằng next-intl theo cùng khóa.
 */
export const ValidationMessage = {
  PASSWORD_LETTER_AND_DIGIT: 'PASSWORD_LETTER_AND_DIGIT',
} as const;
export type ValidationMessage = (typeof ValidationMessage)[keyof typeof ValidationMessage];

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(255));

/** Tối thiểu 8 ký tự, có cả chữ và số (mục 6 của đặc tả). */
export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    params: { i18n: ValidationMessage.PASSWORD_LETTER_AND_DIGIT },
  });

export const personNameSchema = z.string().trim().min(2).max(100);

export const registerCandidateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: personNameSchema,
});
export type RegisterCandidateInput = z.infer<typeof registerCandidateSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // Không áp luật độ mạnh khi đăng nhập: sai thì chỉ báo sai email hoặc mật khẩu.
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;
