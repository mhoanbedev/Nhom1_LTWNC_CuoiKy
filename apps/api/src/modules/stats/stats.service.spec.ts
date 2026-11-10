import { JobStatus } from '@ltwnc/shared';
import { toRecruiterStats, type RawJobStats } from './stats.service';

const zero = { SUBMITTED: 0, REVIEWING: 0, INTERVIEW: 0, PASSED: 0, FAILED: 0, WITHDRAWN: 0 };

function row(overrides: Partial<RawJobStats>): RawJobStats {
  return {
    jobId: 'job-1',
    title: 'Thực tập Backend',
    status: JobStatus.PUBLISHED,
    isHidden: false,
    total: 0,
    ...zero,
    ...overrides,
  };
}

describe('toRecruiterStats', () => {
  it('mỗi tin có đủ mọi trạng thái; tổng cộng dồn từ mọi tin', () => {
    const stats = toRecruiterStats([
      row({ jobId: 'job-1', total: 3, SUBMITTED: 2, PASSED: 1 }),
      row({ jobId: 'job-2', status: JobStatus.DRAFT, isHidden: true, total: 1, SUBMITTED: 1 }),
    ]);

    expect(stats.jobs).toEqual([
      {
        jobId: 'job-1',
        title: 'Thực tập Backend',
        status: 'PUBLISHED',
        isHidden: false,
        total: 3,
        byStatus: { ...zero, SUBMITTED: 2, PASSED: 1 },
      },
      {
        jobId: 'job-2',
        title: 'Thực tập Backend',
        status: 'DRAFT',
        isHidden: true,
        total: 1,
        byStatus: { ...zero, SUBMITTED: 1 },
      },
    ]);
    expect(stats.totals).toEqual({ total: 4, byStatus: { ...zero, SUBMITTED: 3, PASSED: 1 } });
  });

  it('chưa có tin: tổng bằng 0 ở mọi trạng thái', () => {
    expect(toRecruiterStats([])).toEqual({ totals: { total: 0, byStatus: zero }, jobs: [] });
  });
});
