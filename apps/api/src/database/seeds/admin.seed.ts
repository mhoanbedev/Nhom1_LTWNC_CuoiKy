import { Role, UserStatus } from '@ltwnc/shared';
import type { Repository } from 'typeorm';
import type { RefreshToken } from '../../modules/auth/entities/refresh-token.entity';
import type { User } from '../../modules/users/entities/user.entity';

export const ADMIN_NAME = 'Quản trị viên';

export interface AdminSeedInput {
  email: string;
  password: string;
}

export interface AdminSeedDeps {
  users: Repository<User>;
  refreshTokens: Repository<RefreshToken>;
  passwords: {
    hash(plain: string): Promise<string>;
    verify(hash: string, plain: string): Promise<boolean>;
  };
}

export type AdminSeedResult = 'created' | 'updated' | 'unchanged';

/**
 * Bảo đảm có đúng 1 admin với email và mật khẩu theo env. Đã có admin thì cập nhật chính tài khoản
 * đó (kể cả đổi email), không bao giờ tạo admin thứ hai; DB cũng chặn bằng `uq_users_single_admin`.
 * Đổi mật khẩu hoặc email thì thu hồi mọi phiên của admin. Seed là chỗ duy nhất ngoài module
 * users được ghi bảng `users`, vì không có API nào tạo admin.
 */
export async function seedAdmin(
  { users, refreshTokens, passwords }: AdminSeedDeps,
  input: AdminSeedInput,
): Promise<AdminSeedResult> {
  const sameEmail = await users.findOneBy({ email: input.email });
  if (sameEmail && sameEmail.role !== Role.ADMIN) {
    throw new Error(
      `Email ${input.email} đang là tài khoản ${sameEmail.role}. Đổi SEED_ADMIN_EMAIL hoặc xóa tài khoản đó.`,
    );
  }

  const admin = await users.findOneBy({ role: Role.ADMIN });
  if (!admin) {
    await users.save(
      users.create({
        email: input.email,
        name: ADMIN_NAME,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash: await passwords.hash(input.password),
      }),
    );
    return 'created';
  }

  const withHash = await users.findOne({
    where: { id: admin.id },
    select: { id: true, passwordHash: true },
  });
  const samePassword =
    !!withHash?.passwordHash && (await passwords.verify(withHash.passwordHash, input.password));

  const changes: Partial<User> = {};
  if (admin.email !== input.email) changes.email = input.email;
  if (admin.status !== UserStatus.ACTIVE) changes.status = UserStatus.ACTIVE;
  if (!samePassword) {
    changes.passwordHash = await passwords.hash(input.password);
    changes.passwordChangedAt = new Date();
  }
  if (Object.keys(changes).length === 0) return 'unchanged';

  await users.update(admin.id, changes);
  if (changes.passwordHash || changes.email) await refreshTokens.delete({ userId: admin.id });
  return 'updated';
}
