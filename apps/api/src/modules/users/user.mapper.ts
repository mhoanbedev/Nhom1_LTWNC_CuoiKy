import type { AdminUser, AuthUser } from '@ltwnc/shared';
import type { RequestUser } from '../../common/types/request-user';
import type { User } from './entities/user.entity';

/** Entity -> thông tin user trả kèm khi đăng nhập. Không bao giờ chứa passwordHash. */
export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    preferredLocale: user.preferredLocale,
    avatarUrl: user.avatarUrl,
  };
}

/** Entity -> user gắn vào request sau khi xác thực. */
export function toRequestUser(user: User): RequestUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    preferredLocale: user.preferredLocale,
  };
}

/** Entity (kèm `company.translations` nếu là nhà tuyển dụng) → tài khoản trong màn quản trị. */
export function toAdminUser(user: User): AdminUser {
  const company = user.company;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    company: company
      ? { id: company.id, name: company.translations?.find((t) => t.locale === 'vi')?.name ?? '' }
      : null,
    createdAt: user.createdAt.toISOString(),
  };
}
