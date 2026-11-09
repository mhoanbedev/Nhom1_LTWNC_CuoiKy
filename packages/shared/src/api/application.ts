import type { ApplicationStatus } from '../enums/enums';
import type { Locale } from '../enums/locale';
import type { CandidateProfile } from './profile';
import type { PublicCompanySummary } from './public';

/**
 * Ảnh chụp hồ sơ lúc nộp đơn (`profileSnapshot`): về sau ứng viên sửa hồ sơ thì đơn cũ không đổi.
 * Tên kỹ năng lưu theo tiếng Việt; muốn hiện tiếng Anh thì tra theo `skillId`/`slug`.
 */
export interface ProfileSnapshot {
  candidate: { name: string; email: string; avatarUrl: string | null };
  profile: Pick<CandidateProfile, 'basic' | 'education' | 'skills' | 'projects'>;
  takenAt: string;
}

/** Tin của một đơn, tên và slug theo `?lang` (thiếu bản đó thì bản vi, kèm `locale`). */
export interface ApplicationJobSummary {
  id: string;
  shortId: string;
  locale: Locale;
  slug: string;
  title: string;
  company: PublicCompanySummary;
}

export interface ApplicationHistoryItem {
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  /** Ai đổi: ứng viên (nộp, rút đơn) hay nhà tuyển dụng. */
  changedBy: 'CANDIDATE' | 'RECRUITER';
  note: string | null;
  changedAt: string;
}

/** Một đơn trong `GET /me/applications`. */
export interface CandidateApplicationListItem {
  id: string;
  status: ApplicationStatus;
  submittedAt: string;
  updatedAt: string;
  job: ApplicationJobSummary;
}

/** `GET /me/applications/:id` và kết quả nộp đơn. Không có ghi chú nội bộ của nhà tuyển dụng. */
export interface CandidateApplication extends CandidateApplicationListItem {
  coverLetter: string | null;
  cv: { id: string; originalName: string };
  history: ApplicationHistoryItem[];
}

/** Một đơn trong `GET /recruiter/jobs/:id/applications`; thông tin ứng viên lấy từ ảnh chụp hồ sơ. */
export interface RecruiterApplicationListItem {
  id: string;
  status: ApplicationStatus;
  submittedAt: string;
  updatedAt: string;
  candidate: { name: string; email: string; avatarUrl: string | null; headline: string | null };
  cv: { id: string; originalName: string };
}

/** `GET /recruiter/applications/:id` và kết quả đổi trạng thái. */
export interface RecruiterApplication extends RecruiterApplicationListItem {
  job: ApplicationJobSummary;
  coverLetter: string | null;
  /** Hồ sơ 4 bước tại lúc nộp. */
  profile: ProfileSnapshot['profile'];
  snapshotTakenAt: string;
  history: ApplicationHistoryItem[];
  /** Trạng thái nhà tuyển dụng được chuyển tới (để hiện nút); rỗng khi đơn đã kết thúc. */
  allowedTransitions: ApplicationStatus[];
  /** Ghi chú nội bộ, mới nhất lên trước. Chỉ nhà tuyển dụng thấy. */
  notes: ApplicationNote[];
}

/** Ghi chú nội bộ của nhà tuyển dụng về một đơn; chỉ thêm, không sửa, không xóa. */
export interface ApplicationNote {
  id: string;
  content: string;
  /** null khi tài khoản người viết đã bị xóa. */
  author: { id: string; name: string } | null;
  createdAt: string;
}
