import { Role, UserStatus } from '@ltwnc/shared';
import type { Repository } from 'typeorm';
import type { RefreshToken } from '../../modules/auth/entities/refresh-token.entity';
import type { User } from '../../modules/users/entities/user.entity';
import { ADMIN_NAME, seedAdmin, type AdminSeedDeps } from './admin.seed';

const input = { email: 'admin@demo.vn', password: 'Demo@2026' };

const makeAdmin = (overrides: Partial<User> = {}): User =>
  ({
    id: 'admin-1',
    email: 'admin@demo.vn',
    name: ADMIN_NAME,
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
    ...overrides,
  }) as User;

describe('seedAdmin', () => {
  const users = {
    findOneBy: jest.fn<Promise<User | null>, [object]>(),
    findOne: jest.fn<Promise<User | null>, [object]>(),
    create: jest.fn((data: Partial<User>) => data as User),
    save: jest.fn<Promise<User>, [User]>(),
    update: jest.fn<Promise<unknown>, [string, Partial<User>]>(),
  };
  const refreshTokens = { delete: jest.fn<Promise<unknown>, [object]>() };
  const passwords = {
    hash: jest.fn<Promise<string>, [string]>(),
    verify: jest.fn<Promise<boolean>, [string, string]>(),
  };
  const deps = {
    users: users as unknown as Repository<User>,
    refreshTokens: refreshTokens as unknown as Repository<RefreshToken>,
    passwords,
  } satisfies AdminSeedDeps;

  /** findOneBy lần 1: theo email; lần 2: theo role ADMIN. */
  function givenUsers(byEmail: User | null, admin: User | null): void {
    users.findOneBy.mockResolvedValueOnce(byEmail).mockResolvedValueOnce(admin);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    users.findOneBy.mockReset();
    passwords.hash.mockResolvedValue('hash-moi');
  });

  it('chưa có admin thì tạo mới, mật khẩu được băm', async () => {
    givenUsers(null, null);
    await expect(seedAdmin(deps, input)).resolves.toBe('created');
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@demo.vn',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash: 'hash-moi',
      }),
    );
  });

  it('chạy lại với cùng email và mật khẩu thì không đổi gì, giữ phiên đăng nhập', async () => {
    givenUsers(makeAdmin(), makeAdmin());
    users.findOne.mockResolvedValue({ id: 'admin-1', passwordHash: 'hash-cu' } as User);
    passwords.verify.mockResolvedValue(true);
    await expect(seedAdmin(deps, input)).resolves.toBe('unchanged');
    expect(users.update).not.toHaveBeenCalled();
    expect(refreshTokens.delete).not.toHaveBeenCalled();
  });

  it('đổi mật khẩu trong env thì cập nhật admin cũ và thu hồi mọi phiên', async () => {
    givenUsers(makeAdmin(), makeAdmin());
    users.findOne.mockResolvedValue({ id: 'admin-1', passwordHash: 'hash-cu' } as User);
    passwords.verify.mockResolvedValue(false);
    await expect(seedAdmin(deps, input)).resolves.toBe('updated');
    const [id, changes] = users.update.mock.calls[0] ?? [];
    expect(id).toBe('admin-1');
    expect(changes?.passwordHash).toBe('hash-moi');
    expect(changes?.passwordChangedAt).toBeInstanceOf(Date);
    expect(refreshTokens.delete).toHaveBeenCalledWith({ userId: 'admin-1' });
    expect(users.save).not.toHaveBeenCalled();
  });

  it('đổi email trong env thì đổi email của chính admin cũ, không tạo admin thứ hai', async () => {
    givenUsers(null, makeAdmin({ email: 'cu@demo.vn' }));
    users.findOne.mockResolvedValue({ id: 'admin-1', passwordHash: 'hash-cu' } as User);
    passwords.verify.mockResolvedValue(true);
    await expect(seedAdmin(deps, input)).resolves.toBe('updated');
    expect(users.update).toHaveBeenCalledWith('admin-1', { email: 'admin@demo.vn' });
    expect(users.save).not.toHaveBeenCalled();
  });

  it('admin đang bị khóa thì mở khóa', async () => {
    givenUsers(makeAdmin(), makeAdmin({ status: UserStatus.LOCKED }));
    users.findOne.mockResolvedValue({ id: 'admin-1', passwordHash: 'hash-cu' } as User);
    passwords.verify.mockResolvedValue(true);
    await seedAdmin(deps, input);
    expect(users.update).toHaveBeenCalledWith('admin-1', { status: UserStatus.ACTIVE });
  });

  it('email đã thuộc tài khoản không phải admin thì dừng, không sửa gì', async () => {
    givenUsers(makeAdmin({ id: 'u-2', role: Role.CANDIDATE }), null);
    await expect(seedAdmin(deps, input)).rejects.toThrow(/CANDIDATE/);
    expect(users.save).not.toHaveBeenCalled();
    expect(users.update).not.toHaveBeenCalled();
  });
});
