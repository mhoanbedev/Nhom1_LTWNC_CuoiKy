const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 } as const;

export const DURATION_PATTERN = /^(\d+)(s|m|h|d)$/;

/**
 * Đổi chuỗi thời lượng kiểu `15m`, `7d`, `30s` thành số giây.
 * Dùng cho biến môi trường JWT_ACCESS_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN.
 */
export function parseDurationToSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match)
    throw new Error(`Thời lượng không hợp lệ: "${value}" (ví dụ hợp lệ: 30s, 15m, 12h, 7d)`);
  const [, amount = '0', unit = 's'] = match;
  return Number(amount) * UNIT_SECONDS[unit as keyof typeof UNIT_SECONDS];
}
