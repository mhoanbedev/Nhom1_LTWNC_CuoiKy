import { ProfileStep } from '../enums/enums';

/** Thứ tự 4 bước trên form. */
export const PROFILE_STEPS: readonly ProfileStep[] = [
  ProfileStep.BASIC,
  ProfileStep.EDUCATION,
  ProfileStep.SKILLS,
  ProfileStep.PROJECTS,
];

/** Bước bắt buộc trước khi nộp đơn (mục 5.3 của đặc tả); PROJECTS không bắt buộc. */
export const REQUIRED_PROFILE_STEPS: readonly ProfileStep[] = [
  ProfileStep.BASIC,
  ProfileStep.EDUCATION,
  ProfileStep.SKILLS,
];

export interface ProfileCompletion {
  steps: { step: ProfileStep; completed: boolean; required: boolean }[];
  /** Phần trăm số bước đã xong trên tổng 4 bước, làm tròn. */
  percent: number;
  /** Đã xong mọi bước bắt buộc: nộp đơn được. */
  canApply: boolean;
  missingRequired: ProfileStep[];
}

export function profileCompletion(completed: readonly ProfileStep[]): ProfileCompletion {
  const done = new Set(completed);
  const steps = PROFILE_STEPS.map((step) => ({
    step,
    completed: done.has(step),
    required: REQUIRED_PROFILE_STEPS.includes(step),
  }));
  const missingRequired = REQUIRED_PROFILE_STEPS.filter((step) => !done.has(step));
  return {
    steps,
    percent: Math.round((steps.filter((s) => s.completed).length / PROFILE_STEPS.length) * 100),
    canApply: missingRequired.length === 0,
    missingRequired,
  };
}
