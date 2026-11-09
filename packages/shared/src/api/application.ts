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
