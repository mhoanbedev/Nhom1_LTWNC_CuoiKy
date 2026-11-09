import { ErrorCode } from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Schema của format lỗi chung (ApiError trong @ltwnc/shared), chỉ để mô tả trên Swagger. */
export const apiErrorSchema = z.object({
  statusCode: z.number().int().meta({ example: 403 }),
  code: z.enum(Object.values(ErrorCode)).meta({ example: ErrorCode.COMPANY_NOT_APPROVED }),
  message: z.string().meta({ example: 'Công ty của bạn chưa được duyệt' }),
  details: z
    .array(z.object({ field: z.string(), message: z.string() }))
    .nullable()
    .meta({ description: 'Chỉ có khi lỗi validate: từng trường sai' }),
  path: z.string().meta({ example: '/api/v1/recruiter/jobs' }),
  timestamp: z.iso.datetime(),
  requestId: z.string().meta({ example: '0d786000-fec9-4ab2-b78e-d01ca618eeb7' }),
});

export class ApiErrorDto extends createZodDto(apiErrorSchema) {}
