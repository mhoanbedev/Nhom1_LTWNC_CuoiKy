import { dailyRange, fillDailySeries, vnDate } from './daily-series';

describe('vnDate', () => {
  it('lấy ngày theo giờ Việt Nam (UTC+7), không theo UTC', () => {
    // 23:30 UTC ngày 9 là 6:30 sáng ngày 10 ở Việt Nam.
    expect(vnDate(new Date('2026-11-09T23:30:00Z'))).toBe('2026-11-10');
    // 16:59 UTC vẫn là 23:59 cùng ngày ở Việt Nam.
    expect(vnDate(new Date('2026-11-10T16:59:00Z'))).toBe('2026-11-10');
    expect(vnDate(new Date('2026-11-10T17:00:00Z'))).toBe('2026-11-11');
  });
});

describe('dailyRange', () => {
  it('bắt đầu từ 0h giờ VN của ngày đầu tiên', () => {
    const range = dailyRange(3, new Date('2026-11-10T05:00:00Z'));
    expect(range.firstDate).toBe('2026-11-08');
    expect(range.since.toISOString()).toBe('2026-11-07T17:00:00.000Z');
  });

  it('1 ngày là chỉ hôm nay', () => {
    expect(dailyRange(1, new Date('2026-11-10T05:00:00Z')).firstDate).toBe('2026-11-10');
  });
});

describe('fillDailySeries', () => {
  const now = new Date('2026-11-10T05:00:00Z');

  it('điền đủ số ngày, cũ trước, ngày không có đơn là 0', () => {
    expect(fillDailySeries([{ date: '2026-11-09', count: 4 }], 3, now)).toEqual([
      { date: '2026-11-08', count: 0 },
      { date: '2026-11-09', count: 4 },
      { date: '2026-11-10', count: 0 },
    ]);
  });

  it('qua ranh giới tháng và năm vẫn đúng lịch', () => {
    const series = fillDailySeries([], 3, new Date('2027-01-01T05:00:00Z'));
    expect(series.map((day) => day.date)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
  });

  it('bỏ ngày nằm ngoài khoảng', () => {
    const series = fillDailySeries([{ date: '2026-10-01', count: 9 }], 2, now);
    expect(series.reduce((sum, day) => sum + day.count, 0)).toBe(0);
  });
});
