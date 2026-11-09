import { JobStatus } from '../enums/enums';
import { canTransitionJob, jobPublishBlockers } from './job-lifecycle';

const now = new Date('2026-11-09T10:00:00.000Z');
const ready = { expiresAt: '2026-12-01T00:00:00.000Z', hasVietnamese: true, skillCount: 2 };

describe('canTransitionJob', () => {
  const statuses = Object.values(JobStatus);
  const allowed = new Set(['DRAFT>PUBLISHED', 'PUBLISHED>CLOSED', 'CLOSED>PUBLISHED']);

  it.each(statuses.flatMap((from) => statuses.map((to) => [from, to] as const)))(
    '%s → %s',
    (from, to) => {
      expect(canTransitionJob(from, to)).toBe(allowed.has(`${from}>${to}`));
    },
  );
});

describe('jobPublishBlockers', () => {
  it('đủ điều kiện thì không thiếu gì', () => {
    expect(jobPublishBlockers(ready, now)).toEqual([]);
  });

  it('liệt kê đủ mọi điều kiện còn thiếu, kèm trường và khóa dịch', () => {
    expect(
      jobPublishBlockers({ expiresAt: null, hasVietnamese: false, skillCount: 0 }, now),
    ).toEqual([
      { field: 'translations.vi', message: 'JOB_VI_REQUIRED' },
      { field: 'expiresAt', message: 'JOB_EXPIRES_AT_IN_FUTURE' },
      { field: 'skills', message: 'JOB_SKILL_REQUIRED' },
    ]);
  });

  it('hạn đúng bằng bây giờ là chưa đủ, phải ở tương lai', () => {
    expect(jobPublishBlockers({ ...ready, expiresAt: now }, now)).toEqual([
      { field: 'expiresAt', message: 'JOB_EXPIRES_AT_IN_FUTURE' },
    ]);
  });
});
