import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@ltwnc/shared';
import type { DataSource } from 'typeorm';

export interface AdminSession {
  adminId: string;
  token: string;
  /** Gọi trong afterAll: xóa admin tạm nếu test đã phải tạo. */
  cleanup: () => Promise<void>;
}

/**
 * Token admin cho e2e. Hệ thống chỉ có 1 admin (DB chặn admin thứ hai): dùng admin seed nếu có,
 * chưa có (CI, DB mới) thì tạo tạm. Ký JWT thẳng nên không cần biết mật khẩu admin.
 */
export async function adminSession(
  app: INestApplication,
  dataSource: DataSource,
): Promise<AdminSession> {
  const existing = await dataSource.query<{ id: string }[]>(
    `SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`,
  );
  let adminId = existing[0]?.id;
  let created = false;
  if (!adminId) {
    const inserted = await dataSource.query<{ id: string }[]>(
      `INSERT INTO users (email, name, role) VALUES ('e2e-admin@test.local', 'Admin e2e', 'ADMIN') RETURNING id`,
    );
    adminId = inserted[0]?.id;
    created = true;
  }
  if (!adminId) throw new Error('Không tạo được admin cho e2e');

  const token = await app.get(JwtService).signAsync({ sub: adminId, role: Role.ADMIN });
  return {
    adminId,
    token,
    cleanup: async () => {
      if (created) await dataSource.query(`DELETE FROM users WHERE id = $1`, [adminId]);
    },
  };
}
