import { CompanyStatus, JobStatus } from '../enums/enums';
import { isJobExpired, isJobPublic, type JobVisibilityInput } from './job-visibility';

const now = new Date('2026-11-09T10:00:00.000Z');
const approved = { status: CompanyStatus.APPROVED };
const publicJob: JobVisibilityInput = {
  status: JobStatus.PUBLISHED,
  isHidden: false,
  expiresAt: new Date('2026-12-01T00:00:00.000Z'),
};

describe('isJobPublic', () => {
  it('đủ 4 điều kiện thì công khai', () => {
    expect(isJobPublic(publicJob, approved, now)).toBe(true);
  });

  it.each([
    ['nháp', { ...publicJob, status: JobStatus.DRAFT }],
    ['đã đóng', { ...publicJob, status: JobStatus.CLOSED }],
    ['bị admin ẩn', { ...publicJob, isHidden: true }],
    ['đã hết hạn', { ...publicJob, expiresAt: new Date('2026-11-01T00:00:00.000Z') }],
  ])('tin %s thì không công khai', (_label, job) => {
    expect(isJobPublic(job, approved, now)).toBe(false);
  });

  it.each([CompanyStatus.PENDING, CompanyStatus.REJECTED])(
    'công ty %s thì không công khai',
    (status) => {
      expect(isJobPublic(publicJob, { status }, now)).toBe(false);
    },
  );

  it('biên: expiresAt đúng bằng now là đã hết hạn, sau now 1 ms là còn hạn', () => {
    expect(isJobPublic({ ...publicJob, expiresAt: now }, approved, now)).toBe(false);
    const oneMsLater = new Date(now.getTime() + 1);
    expect(isJobPublic({ ...publicJob, expiresAt: oneMsLater }, approved, now)).toBe(true);
  });

  it('nhận expiresAt dạng chuỗi ISO (frontend)', () => {
    expect(
      isJobPublic({ ...publicJob, expiresAt: '2026-12-01T00:00:00.000Z' }, approved, now),
    ).toBe(true);
  });
});

describe('isJobExpired', () => {
  it('so với now', () => {
    expect(isJobExpired({ expiresAt: '2026-11-09T09:59:59.999Z' }, now)).toBe(true);
    expect(isJobExpired({ expiresAt: '2026-11-09T10:00:00.001Z' }, now)).toBe(false);
  });
});
