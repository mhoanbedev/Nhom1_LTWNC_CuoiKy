import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ErrorCode, UserStatus, type AdminUser } from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { NotificationStreamService } from '../notifications/notification-stream.service';
import { UsersService } from '../users/users.service';
import { AccountLockService } from './account-lock.service';
import { RefreshTokenService } from './refresh-token.service';

describe('AccountLockService', () => {
  const manager = {};
  const dataSource = {
    transaction: jest.fn((run: (m: typeof manager) => Promise<unknown>) => run(manager)),
  };
  const users = {
    setStatus: jest.fn<Promise<boolean>, [string, UserStatus, unknown]>(),
    findForAdmin: jest.fn<Promise<AdminUser>, [string]>(),
  };
  const refreshTokens = { revokeAllForUser: jest.fn<Promise<void>, [string, unknown]>() };
  const notificationStream = { close: jest.fn<void, [string]>() };
  let service: AccountLockService;

  beforeEach(async () => {
    jest.clearAllMocks();
    users.findForAdmin.mockResolvedValue({ id: 'user-1' } as AdminUser);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountLockService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: UsersService, useValue: users },
        { provide: RefreshTokenService, useValue: refreshTokens },
        { provide: NotificationStreamService, useValue: notificationStream },
      ],
    }).compile();
    service = moduleRef.get(AccountLockService);
  });

  it('khóa: đổi trạng thái và thu hồi mọi refresh token trong cùng transaction', async () => {
    users.setStatus.mockResolvedValue(true);
    await service.lock('admin-1', 'user-1');
    expect(users.setStatus).toHaveBeenCalledWith('user-1', UserStatus.LOCKED, manager);
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1', manager);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(notificationStream.close).toHaveBeenCalledWith('user-1');
  });

  it('tự khóa chính mình: 400 CANNOT_LOCK_SELF, không ghi gì', async () => {
    const error = await service.lock('admin-1', 'admin-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).code).toBe(ErrorCode.CANNOT_LOCK_SELF);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('user không tồn tại: lỗi 404 từ UsersService, không thu hồi token', async () => {
    users.setStatus.mockRejectedValue(new AppException(ErrorCode.NOT_FOUND));
    await expect(service.lock('admin-1', 'user-x')).rejects.toBeInstanceOf(AppException);
    expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('mở khóa: đặt lại ACTIVE, không đụng token', async () => {
    users.setStatus.mockResolvedValue(true);
    await service.unlock('user-1');
    expect(users.setStatus).toHaveBeenCalledWith('user-1', UserStatus.ACTIVE, manager);
    expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
  });
});
