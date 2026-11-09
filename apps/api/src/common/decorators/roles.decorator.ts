import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@ltwnc/shared';

export const ROLES_KEY = 'roles';

/**
 * Chỉ cho các vai trò liệt kê gọi route; RolesGuard kiểm. Không gắn thì mọi user đã đăng nhập đều qua.
 *
 * @example @Roles(Role.RECRUITER)
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
