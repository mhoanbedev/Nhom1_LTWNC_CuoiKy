import {
  ErrorCode,
  type JobTranslation as JobTranslationDto,
  type RecruiterJob,
  type RecruiterJobListItem,
} from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import type { JobTranslation } from './entities/job-translation.entity';
import type { Job } from './entities/job.entity';

function toTranslation(row: JobTranslation): JobTranslationDto {
  return {
    title: row.title,
    slug: row.slug,
    description: row.description,
    requirements: row.requirements,
    benefits: row.benefits,
  };
}

function viTranslation(job: Job): JobTranslation {
  const vi = job.translations?.find((t) => t.locale === 'vi');
  // Bản vi luôn được tạo cùng tin; thiếu là dữ liệu hỏng.
  if (!vi) throw new AppException(ErrorCode.INTERNAL_ERROR);
  return vi;
}

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

/** Entity (kèm `translations`, `skills`) → tin của nhà tuyển dụng. */
export function toRecruiterJob(job: Job): RecruiterJob {
  const en = job.translations?.find((t) => t.locale === 'en');
  return {
    id: job.id,
    shortId: job.shortId,
    status: job.status,
    isHidden: job.isHidden,
    hiddenReason: job.hiddenReason,
    workMode: job.workMode,
    isPaid: job.isPaid,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    currency: job.currency,
    locationId: job.locationId,
    address: job.address,
    quantity: job.quantity,
    expiresAt: iso(job.expiresAt),
    publishedAt: iso(job.publishedAt),
    closedAt: iso(job.closedAt),
    // Bắt buộc lên trước, rồi theo id để thứ tự ổn định giữa các lần gọi.
    skills: (job.skills ?? [])
      .map((s) => ({ skillId: s.skillId, isRequired: s.isRequired }))
      .sort(
        (a, b) => Number(b.isRequired) - Number(a.isRequired) || a.skillId.localeCompare(b.skillId),
      ),
    translations: { vi: toTranslation(viTranslation(job)), en: en ? toTranslation(en) : null },
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

/** Entity (kèm `translations`) → một dòng trong danh sách tin của nhà tuyển dụng. */
export function toRecruiterJobListItem(job: Job): RecruiterJobListItem {
  return {
    id: job.id,
    shortId: job.shortId,
    status: job.status,
    isHidden: job.isHidden,
    title: viTranslation(job).title,
    hasEnglish: job.translations?.some((t) => t.locale === 'en') ?? false,
    expiresAt: iso(job.expiresAt),
    publishedAt: iso(job.publishedAt),
    updatedAt: job.updatedAt.toISOString(),
  };
}
