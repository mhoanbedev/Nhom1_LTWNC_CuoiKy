import { z } from 'zod';

export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 50;

/** `?page=&limit=` của mọi API danh sách (mục 7 của đặc tả). Query string nên ép kiểu số. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Ô tìm kiếm: bỏ khoảng trắng thừa, rỗng thì coi như không lọc. */
export const searchQuerySchema = z
  .string()
  .trim()
  .max(100)
  .transform((value) => value || undefined)
  .optional();
