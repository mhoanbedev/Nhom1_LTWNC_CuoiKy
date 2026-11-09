import type { ApiErrorDetail } from '../api/response';
import { JobStatus } from '../enums/enums';
import { ValidationMessage } from '../schemas/auth.schema';

/**
 * Bảng chuyển trạng thái tin do nhà tuyển dụng thao tác (mục 5.2 của đặc tả).
 * DRAFT → PUBLISHED (đăng), PUBLISHED → CLOSED (đóng), CLOSED → PUBLISHED (mở lại).
 * Xóa chỉ áp dụng cho DRAFT và không phải một trạng thái; admin ẩn tin là cờ `isHidden` riêng.
 */
export const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  [JobStatus.DRAFT]: [JobStatus.PUBLISHED],
  [JobStatus.PUBLISHED]: [JobStatus.CLOSED],
  [JobStatus.CLOSED]: [JobStatus.PUBLISHED],
};

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

export interface JobPublishInput {
  expiresAt: Date | string | null;
  hasVietnamese: boolean;
  skillCount: number;
}

/**
 * Điều kiện nội dung để tin được đăng (hoặc giữ trạng thái đăng khi sửa): có bản `vi`, hạn nhận
 * đơn ở tương lai, ít nhất 1 kỹ năng. Trả danh sách điều kiện còn thiếu, `message` là khóa dịch
 * ValidationMessage; rỗng là đăng được. Điều kiện công ty đã duyệt kiểm riêng (403).
 */
export function jobPublishBlockers(job: JobPublishInput, now: Date): ApiErrorDetail[] {
  const blockers: ApiErrorDetail[] = [];
  if (!job.hasVietnamese) {
    blockers.push({ field: 'translations.vi', message: ValidationMessage.JOB_VI_REQUIRED });
  }
  if (job.expiresAt === null || new Date(job.expiresAt).getTime() <= now.getTime()) {
    blockers.push({ field: 'expiresAt', message: ValidationMessage.JOB_EXPIRES_AT_IN_FUTURE });
  }
  if (job.skillCount < 1) {
    blockers.push({ field: 'skills', message: ValidationMessage.JOB_SKILL_REQUIRED });
  }
  return blockers;
}
