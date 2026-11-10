import type { JobStatus, UserRole, UserStatus } from '../enums/enums';

/** Một tin trong màn quản trị (`GET /admin/jobs`, kết quả ẩn/bỏ ẩn). */
export interface AdminJob {
  id: string;
  shortId: string;
  status: JobStatus;
  isHidden: boolean;
  hiddenReason: string | null;
  /** Tiêu đề bản vi; `titleEn` null khi tin chưa có bản en. */
  title: string;
  titleEn: string | null;
  company: { id: string; name: string };
  expiresAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Một tài khoản trong màn quản trị (`GET /admin/users`, kết quả khóa/mở khóa). */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  /** Chỉ nhà tuyển dụng có: công ty (tên bản vi). */
  company: { id: string; name: string } | null;
  createdAt: string;
}
