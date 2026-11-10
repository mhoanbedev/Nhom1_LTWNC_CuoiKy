/** Trọng số khi tính độ khớp (mục 5.7 của đặc tả): kỹ năng bắt buộc nặng gấp đôi kỹ năng ưu tiên. */
export const MATCH_WEIGHT = { REQUIRED: 2, PREFERRED: 1 } as const;

export interface MatchJobSkill {
  skillId: string;
  isRequired: boolean;
}

export interface MatchResult {
  /** 0–100, đã làm tròn. */
  score: number;
  /** Kỹ năng của tin mà ứng viên có, theo thứ tự kỹ năng của tin. */
  matchedSkillIds: string[];
}

const weightOf = (skill: MatchJobSkill) =>
  skill.isRequired ? MATCH_WEIGHT.REQUIRED : MATCH_WEIGHT.PREFERRED;

/**
 * Độ khớp giữa kỹ năng ứng viên và kỹ năng của tin: tổng trọng số các kỹ năng khớp chia tổng
 * trọng số của tin, quy ra 0–100. Mức thành thạo của ứng viên không tính. Tin không có kỹ năng
 * nào thì 0. Backend sắp xếp gợi ý bằng cùng công thức này viết trong SQL.
 */
export function matchScore(
  candidateSkillIds: readonly string[],
  jobSkills: readonly MatchJobSkill[],
): MatchResult {
  const owned = new Set(candidateSkillIds);
  const matched = jobSkills.filter((skill) => owned.has(skill.skillId));
  const total = jobSkills.reduce((sum, skill) => sum + weightOf(skill), 0);
  const gained = matched.reduce((sum, skill) => sum + weightOf(skill), 0);
  return {
    score: total === 0 ? 0 : Math.round((gained / total) * 100),
    matchedSkillIds: matched.map((skill) => skill.skillId),
  };
}
