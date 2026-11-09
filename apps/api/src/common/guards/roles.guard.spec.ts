import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, Role, type UserRole } from '@ltwnc/shared';
import { AppException } from '../exceptions/app.exception';
import { RolesGuard } from './roles.guard';

function context(user?: { role: UserRole }): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const requireRoles = (roles: UserRole[] | undefined) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  afterEach(() => jest.restoreAllMocks());

  it('route không gắn @Roles thì cho qua', () => {
    requireRoles(undefined);
    expect(guard.canActivate(context({ role: Role.CANDIDATE }))).toBe(true);
  });

  it('vai trò nằm trong danh sách thì cho qua', () => {
    requireRoles([Role.RECRUITER, Role.ADMIN]);
    expect(guard.canActivate(context({ role: Role.ADMIN }))).toBe(true);
  });

  it('sai vai trò trả 403 FORBIDDEN', () => {
    requireRoles([Role.ADMIN]);
    expect(() => guard.canActivate(context({ role: Role.CANDIDATE }))).toThrow(AppException);
    try {
      guard.canActivate(context({ role: Role.CANDIDATE }));
    } catch (error) {
      expect((error as AppException).code).toBe(ErrorCode.FORBIDDEN);
    }
  });

  it('chưa có user (route công khai gắn nhầm @Roles) cũng trả 403', () => {
    requireRoles([Role.ADMIN]);
    expect(() => guard.canActivate(context())).toThrow(AppException);
  });
});
