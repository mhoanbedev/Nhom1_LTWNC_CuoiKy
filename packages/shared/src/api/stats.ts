import type { ApplicationStatus, JobStatus } from '../enums/enums';

/** Số đơn theo từng trạng thái; trạng thái không có đơn vẫn có mặt với giá trị 0. */
export type ApplicationCounts = Record<ApplicationStatus, number>;

/** Một ngày trong biểu đồ đơn theo ngày (ngày theo giờ Việt Nam). */
export interface DailyCount {
  /** `YYYY-MM-DD`. */
  date: string;
  count: number;
}

/** `GET /admin/stats` (mục 5.9 của đặc tả). */
export interface AdminStats {
  /** Số ngày của `applicationsPerDay` và `topCompanies`. */
  days: number;
  /** Toàn bộ tin; `hidden` đếm riêng vì ẩn là cờ, không phải trạng thái. */
  jobsByStatus: Record<JobStatus, number> & { hidden: number };
  /** Toàn bộ đơn. */
  applicationsByStatus: ApplicationCounts;
  /** Đủ `days` ngày tới hôm nay, cũ trước; ngày không có đơn là 0. */
  applicationsPerDay: DailyCount[];
  /** Tối đa 5 công ty nhận nhiều đơn nhất trong `days` ngày, tên theo `?lang` (thiếu bản thì vi). */
  topCompanies: { id: string; name: string; applicationCount: number }[];
  pendingCompanies: number;
}

/** Số đơn của một tin trong `GET /recruiter/stats`. */
export interface RecruiterJobStats {
  jobId: string;
  /** Tiêu đề bản vi. */
  title: string;
  status: JobStatus;
  isHidden: boolean;
  total: number;
  byStatus: ApplicationCounts;
}

/** `GET /recruiter/stats`: mỗi tin của công ty (mới tạo trước) và tổng cộng mọi tin. */
export interface RecruiterStats {
  totals: { total: number; byStatus: ApplicationCounts };
  jobs: RecruiterJobStats[];
}
