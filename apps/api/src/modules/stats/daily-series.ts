import type { DailyCount } from '@ltwnc/shared';

/** Thống kê theo ngày tính theo giờ Việt Nam, không theo UTC (đơn lúc 6h sáng VN vẫn là hôm nay). */
export const STATS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
/** Việt Nam không có giờ mùa hè, luôn UTC+7. */
const VN_OFFSET = '+07:00';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ngày `YYYY-MM-DD` theo giờ Việt Nam của thời điểm `at`. */
export function vnDate(at: Date): string {
  // en-CA định dạng sẵn YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: STATS_TIME_ZONE }).format(at);
}

/** Lùi `offset` ngày từ một ngày `YYYY-MM-DD` (tính trên lịch, không phụ thuộc múi giờ máy). */
function shiftDate(date: string, offset: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Khoảng `days` ngày kết thúc ở hôm nay (giờ VN): ngày đầu tiên và thời điểm 0h của nó, để lọc
 * `submitted_at >= since`.
 */
export function dailyRange(days: number, now: Date): { firstDate: string; since: Date } {
  const firstDate = shiftDate(vnDate(now), -(days - 1));
  return { firstDate, since: new Date(`${firstDate}T00:00:00${VN_OFFSET}`) };
}

/**
 * Điền đủ `days` ngày tới hôm nay (cũ trước) từ kết quả GROUP BY chỉ có những ngày có đơn;
 * ngày thiếu là 0. Ngày ngoài khoảng (nếu có) bị bỏ.
 */
export function fillDailySeries(rows: DailyCount[], days: number, now: Date): DailyCount[] {
  const counts = new Map(rows.map((row) => [row.date, row.count]));
  const { firstDate } = dailyRange(days, now);
  return Array.from({ length: days }, (_, index) => {
    const date = shiftDate(firstDate, index);
    return { date, count: counts.get(date) ?? 0 };
  });
}
