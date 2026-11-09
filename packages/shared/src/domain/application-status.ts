import { ApplicationStatus } from '../enums/enums';

/** Hai vai trò được đổi trạng thái đơn ứng tuyển. Admin không đổi được. */
export const ApplicationActor = {
  RECRUITER: 'RECRUITER',
  CANDIDATE: 'CANDIDATE',
} as const;
export type ApplicationActor = (typeof ApplicationActor)[keyof typeof ApplicationActor];

/**
 * Bảng chuyển trạng thái ĐƠN ỨNG TUYỂN (mục 5.4 của đặc tả); tin tuyển có bảng riêng là
 * `JOB_TRANSITIONS`. Nhà tuyển dụng đi từng bước SUBMITTED → REVIEWING → INTERVIEW → PASSED, được
 * đánh trượt (FAILED) ở mọi bước còn mở; ứng viên được rút đơn (WITHDRAWN) khi đơn còn mở.
 * PASSED, FAILED, WITHDRAWN là trạng thái kết thúc.
 */
export const APPLICATION_TRANSITIONS: Record<
  ApplicationStatus,
  Partial<Record<ApplicationActor, readonly ApplicationStatus[]>>
> = {
  [ApplicationStatus.SUBMITTED]: {
    [ApplicationActor.RECRUITER]: [ApplicationStatus.REVIEWING, ApplicationStatus.FAILED],
    [ApplicationActor.CANDIDATE]: [ApplicationStatus.WITHDRAWN],
  },
  [ApplicationStatus.REVIEWING]: {
    [ApplicationActor.RECRUITER]: [ApplicationStatus.INTERVIEW, ApplicationStatus.FAILED],
    [ApplicationActor.CANDIDATE]: [ApplicationStatus.WITHDRAWN],
  },
  [ApplicationStatus.INTERVIEW]: {
    [ApplicationActor.RECRUITER]: [ApplicationStatus.PASSED, ApplicationStatus.FAILED],
    [ApplicationActor.CANDIDATE]: [ApplicationStatus.WITHDRAWN],
  },
  [ApplicationStatus.PASSED]: {},
  [ApplicationStatus.FAILED]: {},
  [ApplicationStatus.WITHDRAWN]: {},
};

/**
 * Các trạng thái `actor` được chuyển đơn từ `from` sang, theo thứ tự trong bảng.
 * Frontend dùng để quyết định hiện nút nào (vd đơn REVIEWING: "Mời phỏng vấn", "Từ chối").
 */
export function nextStatuses(
  from: ApplicationStatus,
  actor: ApplicationActor,
): readonly ApplicationStatus[] {
  return APPLICATION_TRANSITIONS[from][actor] ?? [];
}

/**
 * `actor` có được chuyển đơn từ `from` sang `to` không. Backend dùng trước khi đổi trạng thái;
 * sai thì 400 APPLICATION_INVALID_TRANSITION. Chuyển về chính trạng thái hiện tại luôn sai.
 */
export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
  actor: ApplicationActor,
): boolean {
  return nextStatuses(from, actor).includes(to);
}

/** Đơn đã kết thúc (PASSED, FAILED, WITHDRAWN): không ai đổi được trạng thái nữa. */
export function isFinalStatus(status: ApplicationStatus): boolean {
  return Object.values(ApplicationActor).every((actor) => nextStatuses(status, actor).length === 0);
}
