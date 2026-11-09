import { z } from 'zod';
import { ApplicationStatus } from '../enums/enums';
import { paginationQuerySchema } from './pagination.schema';

export const COVER_LETTER_MAX = 3000;

/** `POST /jobs/:jobId/applications`. CV bắt buộc; frontend chọn sẵn CV mặc định. */
export const applySchema = z.object({
  cvFileId: z.uuid(),
  coverLetter: z
    .string()
    .trim()
    .max(COVER_LETTER_MAX)
    .transform((value) => value || null)
    .nullish(),
});
export type ApplyInput = z.infer<typeof applySchema>;

/** `GET /me/applications`: lọc theo trạng thái, phân trang. */
export const myApplicationsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(Object.values(ApplicationStatus)).optional(),
});
export type MyApplicationsQuery = z.infer<typeof myApplicationsQuerySchema>;
