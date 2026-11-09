import {
  profileCompletion,
  type CandidateProfile as CandidateProfileDto,
  type Locale,
} from '@ltwnc/shared';
import { localizedName } from '../meta/entities/localized-name.entity';
import type { CandidateProfile } from './entities/candidate-profile.entity';

/** Cột `date` lưu ngày 1 của tháng; API dùng `YYYY-MM`. */
export const toYearMonth = (date: string): string => date.slice(0, 7);
export const fromYearMonth = (yearMonth: string): string => `${yearMonth}-01`;
const toYearMonthOrNull = (date: string | null) => (date ? toYearMonth(date) : null);

export const EMPTY_PROFILE: CandidateProfileDto = {
  basic: null,
  education: [],
  skills: [],
  projects: [],
  completion: profileCompletion([]),
  updatedAt: null,
};

/**
 * Entity (kèm education, skills.skill, projects) → hồ sơ trả về.
 * Học vấn và dự án xếp mới nhất lên trước; kỹ năng xếp mức cao lên trước.
 */
export function toCandidateProfile(profile: CandidateProfile, lang: Locale): CandidateProfileDto {
  const byStartDesc = <T extends { startDate: string | null }>(a: T, b: T) =>
    (b.startDate ?? '').localeCompare(a.startDate ?? '');
  return {
    basic: profile.headline
      ? {
          headline: profile.headline,
          phone: profile.phone,
          dateOfBirth: profile.dateOfBirth,
          locationId: profile.locationId,
          about: profile.about,
          links: profile.links,
        }
      : null,
    education: [...(profile.education ?? [])].sort(byStartDesc).map((row) => ({
      id: row.id,
      school: row.school,
      major: row.major,
      degree: row.degree,
      startDate: toYearMonth(row.startDate),
      endDate: toYearMonthOrNull(row.endDate),
      gpa: row.gpa,
    })),
    skills: (profile.skills ?? [])
      .flatMap((row) =>
        row.skill
          ? [
              {
                skillId: row.skillId,
                slug: row.skill.slug,
                name: localizedName(row.skill, lang),
                level: row.level,
              },
            ]
          : [],
      )
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, lang)),
    projects: [...(profile.projects ?? [])].sort(byStartDesc).map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      description: row.description,
      techStack: row.techStack,
      url: row.url,
      startDate: toYearMonthOrNull(row.startDate),
      endDate: toYearMonthOrNull(row.endDate),
    })),
    completion: profileCompletion(profile.completedSteps),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
