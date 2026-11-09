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

export const STATUS_NOTE_MAX = 500;

/**
 * `PATCH /recruiter/applications/:id/status`. `note` ghi vào lịch sử và ứng viên cũng thấy
 * (vd "Mời phỏng vấn 9h thứ Hai"); ghi chú chỉ nhà tuyển dụng thấy là ghi chú nội bộ, endpoint riêng.
 */
export const changeApplicationStatusSchema = z.object({
  to: z.enum(Object.values(ApplicationStatus)),
  note: z
    .string()
    .trim()
    .max(STATUS_NOTE_MAX)
    .transform((value) => value || null)
    .nullish(),
});
export type ChangeApplicationStatusInput = z.infer<typeof changeApplicationStatusSchema>;

/** `GET /recruiter/jobs/:id/applications`: lọc theo trạng thái, phân trang. */
export const recruiterApplicationsQuerySchema = myApplicationsQuerySchema;
export type RecruiterApplicationsQuery = z.infer<typeof recruiterApplicationsQuerySchema>;

export const APPLICATION_NOTE_MAX = 2000;

/** `POST /recruiter/applications/:id/notes`: ghi chú nội bộ, ứng viên không bao giờ thấy. */
export const createApplicationNoteSchema = z.object({
  content: z.string().trim().min(1).max(APPLICATION_NOTE_MAX),
});
export type CreateApplicationNoteInput = z.infer<typeof createApplicationNoteSchema>;
