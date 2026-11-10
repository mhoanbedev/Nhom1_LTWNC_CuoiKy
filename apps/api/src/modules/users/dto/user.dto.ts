import { adminUsersQuerySchema, USER_ROLES, UserStatus } from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class AdminUsersQueryDto extends createZodDto(adminUsersQuerySchema) {}

/** Chỉ để mô tả trên Swagger; kiểu thật là AdminUser trong @ltwnc/shared. */
export class AdminUserDto extends createZodDto(
  z.object({
    id: z.uuid(),
    email: z.email(),
    name: z.string(),
    role: z.enum(USER_ROLES),
    status: z.enum(Object.values(UserStatus)),
    company: z
      .object({ id: z.uuid(), name: z.string().meta({ description: 'Tên bản vi' }) })
      .nullable()
      .meta({ description: 'Chỉ nhà tuyển dụng có' }),
    createdAt: z.iso.datetime(),
  }),
) {}
