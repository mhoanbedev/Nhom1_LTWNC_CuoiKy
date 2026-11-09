import { createHash, randomBytes } from 'node:crypto';

/** Độ dài token gốc: 64 byte ngẫu nhiên, mã hoá base64url (86 ký tự). */
const TOKEN_BYTES = 64;

/** Sinh refresh token mới. Token gốc chỉ trả cho client một lần, DB chỉ lưu hash. */
export function generateRefreshToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** SHA-256 dạng hex (64 ký tự). Token đủ ngẫu nhiên nên không cần salt hay hàm băm chậm. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type RefreshDecision =
  /** Token còn hiệu lực: thu hồi nó và cấp token mới cùng family. */
  | 'rotate'
  /** Token vừa bị xoay trong khoảng ân hạn (Next gửi 2 request refresh gần như cùng lúc): cấp thêm token cùng family. */
  | 'grace'
  /** Token đã thu hồi mà vẫn bị gửi lên ngoài khoảng ân hạn: nghi bị lộ, thu hồi cả family. */
  | 'reuse'
  /** Không có trong DB hoặc đã hết hạn. */
  | 'invalid';

export interface RefreshTokenState {
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

/**
 * Quyết định cách xử lý một refresh token (mục 6 của đặc tả). Hàm thuần để test đủ trường hợp biên.
 * Token bị thu hồi do đăng xuất (không có replacedById) không được hưởng ân hạn.
 */
export function decideRefresh(
  token: RefreshTokenState | null,
  now: Date,
  graceSeconds: number,
): RefreshDecision {
  if (!token) return 'invalid';
  if (token.expiresAt.getTime() <= now.getTime()) return 'invalid';
  if (!token.revokedAt) return 'rotate';

  const revokedForMs = now.getTime() - token.revokedAt.getTime();
  if (token.replacedById && revokedForMs <= graceSeconds * 1000) return 'grace';
  return 'reuse';
}
