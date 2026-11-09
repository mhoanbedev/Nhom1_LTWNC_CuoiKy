import { CompanyStatus, JobStatus } from '../enums/enums';

export interface JobVisibilityInput {
  status: JobStatus;
  isHidden: boolean;
  /** Date ở backend, chuỗi ISO khi frontend nhận từ API. */
  expiresAt: Date | string;
}

export interface CompanyVisibilityInput {
  status: CompanyStatus;
}

/** Tin còn hạn khi `expiresAt` sau thời điểm `now` (đúng bằng `now` là đã hết hạn). */
export function isJobExpired(job: Pick<JobVisibilityInput, 'expiresAt'>, now: Date): boolean {
  return new Date(job.expiresAt).getTime() <= now.getTime();
}

/**
 * Tin công khai (mục 5.2 của đặc tả) khi đủ 4 điều kiện: PUBLISHED, không bị admin ẩn,
 * công ty đã duyệt, còn hạn. Tin công khai mới được index và nhận đơn.
 */
export function isJobPublic(
  job: JobVisibilityInput,
  company: CompanyVisibilityInput,
  now: Date,
): boolean {
  return (
    job.status === JobStatus.PUBLISHED &&
    !job.isHidden &&
    company.status === CompanyStatus.APPROVED &&
    !isJobExpired(job, now)
  );
}
