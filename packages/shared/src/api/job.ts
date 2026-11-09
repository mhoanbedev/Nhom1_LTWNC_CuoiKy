import type { JobStatus, WorkMode } from '../enums/enums';
import type { Currency } from '../schemas/job.schema';

export interface JobTranslation {
  title: string;
  /** `<tiêu đề không dấu>-<shortId>`, sinh một lần lúc tạo bản dịch. */
  slug: string;
  description: string | null;
  requirements: string | null;
  benefits: string | null;
}

export interface JobSkillRef {
  skillId: string;
  isRequired: boolean;
}

/** Tin của nhà tuyển dụng (`/recruiter/jobs/:id`): đủ mọi trường và cả hai bản dịch. */
export interface RecruiterJob {
  id: string;
  /** 6 ký tự a-z0-9 ở cuối slug, dùng để tìm tin công khai. */
  shortId: string;
  status: JobStatus;
  isHidden: boolean;
  hiddenReason: string | null;
  workMode: WorkMode;
  isPaid: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: Currency;
  locationId: string | null;
  address: string | null;
  quantity: number;
  expiresAt: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  skills: JobSkillRef[];
  translations: {
    vi: JobTranslation;
    en: JobTranslation | null;
  };
  createdAt: string;
  updatedAt: string;
}

/** Một dòng trong danh sách tin của nhà tuyển dụng. */
export interface RecruiterJobListItem {
  id: string;
  shortId: string;
  status: JobStatus;
  isHidden: boolean;
  /** Tiêu đề bản vi. */
  title: string;
  hasEnglish: boolean;
  expiresAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}
