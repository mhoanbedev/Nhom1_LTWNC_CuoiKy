import {
  changePasswordSchema,
  googleLoginSchema,
  LOCALES,
  loginSchema,
  refreshTokenSchema,
  registerCandidateSchema,
  updateMeSchema,
  USER_ROLES,
} from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class RegisterCandidateDto extends createZodDto(registerCandidateSchema) {}

export class LoginDto extends createZodDto(loginSchema) {}

export class GoogleLoginDto extends createZodDto(googleLoginSchema) {}

export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}

export class UpdateMeDto extends createZodDto(updateMeSchema) {}

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}

/** Chỉ để mô tả trên Swagger; kiểu thật là AuthUser trong @ltwnc/shared. */
const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: z.enum(USER_ROLES),
  companyId: z.uuid().nullable(),
  preferredLocale: z.enum(LOCALES),
  avatarUrl: z.url().nullable(),
});

export class AuthUserDto extends createZodDto(authUserSchema) {}

export class AuthResponseDto extends createZodDto(
  z.object({
    accessToken: z.string().meta({ description: 'JWT, gửi kèm header Authorization: Bearer' }),
    accessTokenExpiresAt: z.iso.datetime(),
    refreshToken: z
      .string()
      .meta({ description: 'Chuỗi ngẫu nhiên (không phải JWT), dùng một lần cho /auth/refresh' }),
    refreshTokenExpiresAt: z.iso.datetime(),
    user: authUserSchema,
  }),
) {}
