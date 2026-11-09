import { notificationsQuerySchema, NotificationType } from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class NotificationsQueryDto extends createZodDto(notificationsQuerySchema) {}

/** Chỉ để mô tả trên Swagger; kiểu thật là NotificationItem trong @ltwnc/shared. */
export class NotificationItemDto extends createZodDto(
  z.object({
    id: z.uuid(),
    type: z.enum(Object.values(NotificationType)),
    data: z.looseObject({}).meta({
      description:
        'Tham số theo type: applicationId, jobId, jobTitle { vi, en }, candidateName, fromStatus, toStatus, note, companyId, companyName, reason',
    }),
    title: z.string().meta({ example: 'Hồ sơ ứng tuyển của bạn được cập nhật' }),
    body: z.string().meta({ example: '"Thực tập Backend": Đang xem xét → Phỏng vấn' }),
    readAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  }),
) {}

export class UnreadCountDto extends createZodDto(z.object({ count: z.number().int() })) {}

export class ReadAllResultDto extends createZodDto(z.object({ updated: z.number().int() })) {}
