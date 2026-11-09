/**
 * Enum dùng chung cho api và web.
 *
 * Viết dạng object `as const` + union type thay cho `enum` của TypeScript:
 * - Zod dùng thẳng được: `z.enum(Object.values(JobStatus))`.
 * - TypeORM dùng được cho cột enum Postgres: `enum: Object.values(JobStatus)`.
 * - Next.js không phải mang theo code runtime của `enum`.
 */

type ValueOf<T> = T[keyof T];

export const Role = {
  /** Chỉ dùng ở tầng phân quyền, không lưu DB. */
  GUEST: 'GUEST',
  CANDIDATE: 'CANDIDATE',
  RECRUITER: 'RECRUITER',
  ADMIN: 'ADMIN',
} as const;
export type Role = ValueOf<typeof Role>;

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
} as const;
export type UserStatus = ValueOf<typeof UserStatus>;

export const CompanyStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type CompanyStatus = ValueOf<typeof CompanyStatus>;

/** Admin ẩn tin là cờ `isHidden` riêng, không phải một trạng thái. */
export const JobStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CLOSED: 'CLOSED',
} as const;
export type JobStatus = ValueOf<typeof JobStatus>;

export const WorkMode = {
  ONSITE: 'ONSITE',
  REMOTE: 'REMOTE',
  HYBRID: 'HYBRID',
} as const;
export type WorkMode = ValueOf<typeof WorkMode>;

export const ApplicationStatus = {
  SUBMITTED: 'SUBMITTED',
  REVIEWING: 'REVIEWING',
  INTERVIEW: 'INTERVIEW',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type ApplicationStatus = ValueOf<typeof ApplicationStatus>;

export const ProfileStep = {
  BASIC: 'BASIC',
  EDUCATION: 'EDUCATION',
  SKILLS: 'SKILLS',
  PROJECTS: 'PROJECTS',
} as const;
export type ProfileStep = ValueOf<typeof ProfileStep>;

export const NotificationType = {
  APPLICATION_STATUS_CHANGED: 'APPLICATION_STATUS_CHANGED',
  NEW_APPLICATION: 'NEW_APPLICATION',
  COMPANY_APPROVED: 'COMPANY_APPROVED',
  COMPANY_REJECTED: 'COMPANY_REJECTED',
  JOB_HIDDEN: 'JOB_HIDDEN',
} as const;
export type NotificationType = ValueOf<typeof NotificationType>;

const applicationStatuses: readonly string[] = Object.values(ApplicationStatus);

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && applicationStatuses.includes(value);
}
