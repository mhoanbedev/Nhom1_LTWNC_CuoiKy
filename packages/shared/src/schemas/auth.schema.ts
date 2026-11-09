import { z } from 'zod';

/**
 * Lỗi validate tự đặt mang `params.i18n`: API dịch theo src/i18n/<lang>/validation.json,
 * frontend dịch bằng next-intl theo cùng khóa.
 */
export const ValidationMessage = {
  PASSWORD_LETTER_AND_DIGIT: 'PASSWORD_LETTER_AND_DIGIT',
  PASSWORD_SAME_AS_CURRENT: 'PASSWORD_SAME_AS_CURRENT',
  AT_LEAST_ONE_FIELD: 'AT_LEAST_ONE_FIELD',
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

/** Body của /auth/refresh và /auth/logout. Refresh token là chuỗi ngẫu nhiên, không phải JWT. */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(32).max(256),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

/** PATCH /auth/me: đổi tên hoặc ngôn ngữ ưa thích (khi người dùng chuyển ngôn ngữ trên giao diện). */
export const updateMeSchema = z
  .object({
    name: personNameSchema.optional(),
    preferredLocale: z.enum(['vi', 'en']).optional(),
  })
  .refine((value) => value.name !== undefined || value.preferredLocale !== undefined, {
    params: { i18n: ValidationMessage.AT_LEAST_ONE_FIELD },
  });
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

/**
 * PATCH /auth/me/password. `currentPassword` bắt buộc khi tài khoản đã có mật khẩu;
 * tài khoản chỉ đăng nhập Google được bỏ trống để đặt mật khẩu lần đầu.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    params: { i18n: ValidationMessage.PASSWORD_SAME_AS_CURRENT },
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
