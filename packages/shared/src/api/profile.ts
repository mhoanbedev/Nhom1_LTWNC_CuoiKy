import type { ProfileCompletion } from '../domain/profile-completion';

export interface ProfileLink {
  label: string;
  url: string;
}

export interface ProfileBasic {
  headline: string;
  phone: string | null;
  /** `YYYY-MM-DD`. */
  dateOfBirth: string | null;
  locationId: string | null;
  about: string | null;
  links: ProfileLink[];
}

export interface EducationItem {
  id: string;
  school: string;
  major: string | null;
  degree: string | null;
  /** `YYYY-MM`. */
  startDate: string;
  /** `YYYY-MM`; null là đang học. */
  endDate: string | null;
  gpa: number | null;
}

export interface CandidateSkillItem {
  skillId: string;
  slug: string;
  /** Tên theo `?lang`. */
  name: string;
  level: number;
}

export interface ProjectItem {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  techStack: string[];
  url: string | null;
  startDate: string | null;
  endDate: string | null;
}

/** `GET /me/profile` và kết quả mỗi `PUT /me/profile/<bước>`. */
export interface CandidateProfile {
  /** null khi chưa lưu bước 1. */
  basic: ProfileBasic | null;
  education: EducationItem[];
  skills: CandidateSkillItem[];
  projects: ProjectItem[];
  completion: ProfileCompletion;
  updatedAt: string | null;
}
