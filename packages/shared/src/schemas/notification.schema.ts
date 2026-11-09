import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema';

/** `GET /me/notifications`: `?unread=true` chỉ lấy thông báo chưa đọc. */
export const notificationsQuerySchema = paginationQuerySchema.extend({
  unread: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
