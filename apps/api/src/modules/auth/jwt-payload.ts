import { USER_ROLES, type UserRole } from '@ltwnc/shared';

/** Nội dung access token. Chỉ để tham khảo; quyền thật luôn đọc lại từ DB. */
export interface JwtPayload {
  sub: string;
  role: UserRole;
  /** Thời điểm cấp (giây), do thư viện JWT tự thêm. */
  iat?: number;
  /** Thời điểm hết hạn (giây), do thư viện JWT tự thêm. */
  exp?: number;
}

export function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== 'object' || value === null) return false;
  const { sub, role, iat, exp } = value as Record<string, unknown>;
  return (
    typeof sub === 'string' &&
    typeof role === 'string' &&
    (USER_ROLES as readonly string[]).includes(role) &&
    (iat === undefined || typeof iat === 'number') &&
    (exp === undefined || typeof exp === 'number')
  );
}
