import { LOCALES, loginSchema, registerCandidateSchema, USER_ROLES } from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class RegisterCandidateDto extends createZodDto(registerCandidateSchema) {}

export class LoginDto extends createZodDto(loginSchema) {}

/** Chỉ để mô tả trên Swagger; kiểu thật là AuthResponse trong @ltwnc/shared. */
const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: z.enum(USER_ROLES),
  companyId: z.uuid().nullable(),
  preferredLocale: z.enum(LOCALES),
  avatarUrl: z.url().nullable(),
});

export class AuthResponseDto extends createZodDto(
  z.object({
    accessToken: z.string().meta({ description: 'JWT, gửi kèm header Authorization: Bearer' }),
    accessTokenExpiresAt: z.iso.datetime(),
    user: authUserSchema,
  }),
) {}
