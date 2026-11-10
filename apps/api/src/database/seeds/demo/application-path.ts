import { ApplicationActor, ApplicationStatus } from '@ltwnc/shared';

export interface PathStep {
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  actor: ApplicationActor;
}

/** Bước tiến của nhà tuyển dụng: SUBMITTED → REVIEWING → INTERVIEW → PASSED. */
const FORWARD = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.REVIEWING,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.PASSED,
] as const;

/**
 * Chuỗi trạng thái hợp lệ (theo bảng 5.4) để một đơn đi tới `final`, kể cả bước nộp đơn ban đầu.
 * `stopAt` là số bước tiến trước khi trượt hay rút (0 = ngay khi mới nộp), chỉ dùng cho FAILED,
 * WITHDRAWN; seed truyền ngẫu nhiên để có đủ kiểu đơn.
 */
export function applicationPath(final: ApplicationStatus, stopAt = 0): PathStep[] {
  const steps: PathStep[] = [
    { from: null, to: ApplicationStatus.SUBMITTED, actor: ApplicationActor.CANDIDATE },
  ];
  const advance = (until: number) => {
    for (let index = 1; index <= until; index += 1) {
      const from = FORWARD[index - 1];
      const to = FORWARD[index];
      if (from && to) steps.push({ from, to, actor: ApplicationActor.RECRUITER });
    }
  };
  const forwardIndex = FORWARD.indexOf(final as (typeof FORWARD)[number]);
  if (forwardIndex >= 0) {
    advance(forwardIndex);
    return steps;
  }
  // FAILED, WITHDRAWN: tiến tới một bước còn mở (SUBMITTED, REVIEWING, INTERVIEW) rồi dừng.
  const reached = Math.min(Math.max(stopAt, 0), 2);
  advance(reached);
  const from = FORWARD[reached] ?? ApplicationStatus.SUBMITTED;
  steps.push({
    from,
    to: final,
    actor:
      final === ApplicationStatus.WITHDRAWN
        ? ApplicationActor.CANDIDATE
        : ApplicationActor.RECRUITER,
  });
  return steps;
}
