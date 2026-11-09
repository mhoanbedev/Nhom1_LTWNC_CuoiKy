import { ApplicationStatus } from '../enums/enums';
import { ApplicationActor, canTransition, isFinalStatus, nextStatuses } from './application-status';

const S = ApplicationStatus;
const { RECRUITER, CANDIDATE } = ApplicationActor;

/** Bảng mục 5.4 của đặc tả viết lại dạng danh sách cặp "từ>sang" được phép, để đối chiếu. */
const ALLOWED: Record<ApplicationActor, ReadonlySet<string>> = {
  RECRUITER: new Set([
    'SUBMITTED>REVIEWING',
    'SUBMITTED>FAILED',
    'REVIEWING>INTERVIEW',
    'REVIEWING>FAILED',
    'INTERVIEW>PASSED',
    'INTERVIEW>FAILED',
  ]),
  CANDIDATE: new Set(['SUBMITTED>WITHDRAWN', 'REVIEWING>WITHDRAWN', 'INTERVIEW>WITHDRAWN']),
};

describe('canTransition', () => {
  const statuses = Object.values(ApplicationStatus);
  const actors = Object.values(ApplicationActor);
  // 6 trạng thái gốc × 6 trạng thái đích × 2 vai trò = 72 trường hợp.
  const cases = actors.flatMap((actor) =>
    statuses.flatMap((from) => statuses.map((to) => [actor, from, to] as const)),
  );

  it('kiểm đủ 72 tổ hợp', () => {
    expect(cases).toHaveLength(72);
  });

  it.each(cases)('%s: %s → %s', (actor, from, to) => {
    expect(canTransition(from, to, actor)).toBe(ALLOWED[actor].has(`${from}>${to}`));
  });

  it('chuyển về chính trạng thái hiện tại luôn sai', () => {
    for (const status of statuses) {
      expect(canTransition(status, status, RECRUITER)).toBe(false);
      expect(canTransition(status, status, CANDIDATE)).toBe(false);
    }
  });

  it('nhà tuyển dụng không nhảy cóc SUBMITTED → INTERVIEW hay → PASSED', () => {
    expect(canTransition(S.SUBMITTED, S.INTERVIEW, RECRUITER)).toBe(false);
    expect(canTransition(S.SUBMITTED, S.PASSED, RECRUITER)).toBe(false);
  });

  it('ứng viên không tự đổi sang trạng thái của nhà tuyển dụng, nhà tuyển dụng không rút đơn hộ', () => {
    expect(canTransition(S.SUBMITTED, S.REVIEWING, CANDIDATE)).toBe(false);
    expect(canTransition(S.SUBMITTED, S.WITHDRAWN, RECRUITER)).toBe(false);
  });
});

describe('nextStatuses', () => {
  it('trả đúng thứ tự trong bảng (dùng để hiện nút)', () => {
    expect(nextStatuses(S.SUBMITTED, RECRUITER)).toEqual([S.REVIEWING, S.FAILED]);
    expect(nextStatuses(S.REVIEWING, RECRUITER)).toEqual([S.INTERVIEW, S.FAILED]);
    expect(nextStatuses(S.INTERVIEW, RECRUITER)).toEqual([S.PASSED, S.FAILED]);
    expect(nextStatuses(S.INTERVIEW, CANDIDATE)).toEqual([S.WITHDRAWN]);
  });

  it('trạng thái kết thúc không đi đâu được', () => {
    for (const status of [S.PASSED, S.FAILED, S.WITHDRAWN]) {
      expect(nextStatuses(status, RECRUITER)).toEqual([]);
      expect(nextStatuses(status, CANDIDATE)).toEqual([]);
    }
  });
});

describe('isFinalStatus', () => {
  it.each([
    [S.SUBMITTED, false],
    [S.REVIEWING, false],
    [S.INTERVIEW, false],
    [S.PASSED, true],
    [S.FAILED, true],
    [S.WITHDRAWN, true],
  ])('%s → %s', (status, expected) => {
    expect(isFinalStatus(status)).toBe(expected);
  });
});
