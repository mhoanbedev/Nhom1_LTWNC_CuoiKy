import type {
  ApplicationHistoryItem,
  ApplicationJobSummary,
  CandidateApplication,
  CandidateApplicationListItem,
  Locale,
  ApplicationNote as ApplicationNoteDto,
  RecruiterApplication,
  RecruiterApplicationListItem,
} from '@ltwnc/shared';
import { ApplicationActor, ErrorCode, nextStatuses } from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { companySummary, pickTranslation } from '../jobs/public-job.mapper';
import type { Job } from '../jobs/entities/job.entity';
import type { ApplicationNote } from './entities/application-note.entity';
import type { ApplicationStatusHistory } from './entities/application-status-history.entity';
import type { Application } from './entities/application.entity';

/** Tin (kèm translations, company.translations) → tóm tắt tin của đơn, theo `lang` (thiếu thì vi). */
export function toApplicationJobSummary(job: Job | undefined, lang: Locale): ApplicationJobSummary {
  if (!job) throw new AppException(ErrorCode.INTERNAL_ERROR);
  const translation = pickTranslation(job.translations, lang);
  return {
    id: job.id,
    shortId: job.shortId,
    locale: translation.locale,
    slug: translation.slug,
    title: translation.title,
    company: companySummary(job.company, lang),
  };
}

/** Lịch sử theo thời gian; người đổi là chính ứng viên thì CANDIDATE, còn lại RECRUITER. */
export function toHistory(
  rows: ApplicationStatusHistory[] | undefined,
  candidateId: string,
): ApplicationHistoryItem[] {
  return [...(rows ?? [])]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((row) => ({
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      changedBy: row.changedById === candidateId ? 'CANDIDATE' : 'RECRUITER',
      note: row.note,
      changedAt: row.createdAt.toISOString(),
    }));
}

export function toCandidateApplicationListItem(
  application: Application,
  lang: Locale,
): CandidateApplicationListItem {
  return {
    id: application.id,
    status: application.status,
    submittedAt: application.submittedAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    job: toApplicationJobSummary(application.job, lang),
  };
}

/** Đơn (kèm job, cvFile, history) → chi tiết cho ứng viên; không có ghi chú nội bộ. */
export function toCandidateApplication(
  application: Application,
  lang: Locale,
): CandidateApplication {
  const cv = application.cvFile;
  if (!cv) throw new AppException(ErrorCode.INTERNAL_ERROR);
  return {
    ...toCandidateApplicationListItem(application, lang),
    coverLetter: application.coverLetter,
    cv: { id: cv.id, originalName: cv.originalName },
    history: toHistory(application.history, application.candidateId),
  };
}

/** Đơn (kèm cvFile) → một dòng trong danh sách đơn của nhà tuyển dụng. */
export function toRecruiterApplicationListItem(
  application: Application,
): RecruiterApplicationListItem {
  const cv = application.cvFile;
  if (!cv) throw new AppException(ErrorCode.INTERNAL_ERROR);
  const { candidate, profile } = application.profileSnapshot;
  return {
    id: application.id,
    status: application.status,
    submittedAt: application.submittedAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    candidate: { ...candidate, headline: profile.basic?.headline ?? null },
    cv: { id: cv.id, originalName: cv.originalName },
  };
}

/** Đơn (kèm job, cvFile, history) → chi tiết cho nhà tuyển dụng, kèm trạng thái được chuyển tới. */
export function toRecruiterApplication(
  application: Application,
  lang: Locale,
): RecruiterApplication {
  return {
    ...toRecruiterApplicationListItem(application),
    job: toApplicationJobSummary(application.job, lang),
    coverLetter: application.coverLetter,
    profile: application.profileSnapshot.profile,
    snapshotTakenAt: application.profileSnapshot.takenAt,
    history: toHistory(application.history, application.candidateId),
    allowedTransitions: [...nextStatuses(application.status, ApplicationActor.RECRUITER)],
    notes: toNotes(application.notes),
  };
}

/** Ghi chú (kèm author) → mới nhất lên trước. */
export function toNotes(rows: ApplicationNote[] | undefined): ApplicationNoteDto[] {
  return [...(rows ?? [])]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((row) => ({
      id: row.id,
      content: row.content,
      author: row.author ? { id: row.author.id, name: row.author.name } : null,
      createdAt: row.createdAt.toISOString(),
    }));
}
