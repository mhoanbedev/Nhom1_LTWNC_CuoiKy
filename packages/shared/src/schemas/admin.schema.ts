import { z } from 'zod';
import { CompanyStatus, JobStatus, USER_ROLES, UserStatus } from '../enums/enums';
import { paginationQuerySchema, searchQuerySchema } from './pagination.schema';

/** `GET /admin/companies`: lọc theo trạng thái và tên công ty (gõ không dấu được). */
export const adminCompaniesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(Object.values(CompanyStatus)).optional(),
  q: searchQuerySchema,
});
export type AdminCompaniesQuery = z.infer<typeof adminCompaniesQuerySchema>;

/** Từ chối công ty bắt buộc có lý do, nhà tuyển dụng thấy lý do này để sửa. */
export const rejectCompanySchema = z.object({
  reason: z.string().trim().min(5).max(500),
});
export type RejectCompanyInput = z.infer<typeof rejectCompanySchema>;

/** Cờ true/false trên query string (`?hidden=true`). */
const booleanFlag = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

/**
 * `GET /admin/jobs`: tin ở mọi trạng thái (kể cả nháp). `q` tìm theo tiêu đề cả hai ngôn ngữ,
 * gõ không dấu được; `hidden=true` chỉ lấy tin bị ẩn.
 */
export const adminJobsQuerySchema = paginationQuerySchema.extend({
  q: searchQuerySchema,
  status: z.enum(Object.values(JobStatus)).optional(),
  hidden: booleanFlag,
});
export type AdminJobsQuery = z.infer<typeof adminJobsQuerySchema>;

/** Ẩn tin bắt buộc có lý do; nhà tuyển dụng nhận lý do trong thông báo JOB_HIDDEN. */
export const hideJobSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});
export type HideJobInput = z.infer<typeof hideJobSchema>;

/** `GET /admin/users`: lọc theo vai trò, trạng thái; `q` tìm trong email và tên. */
export const adminUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(Object.values(UserStatus)).optional(),
  q: searchQuerySchema,
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
