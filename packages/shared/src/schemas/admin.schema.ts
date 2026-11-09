import { z } from 'zod';
import { CompanyStatus } from '../enums/enums';
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
