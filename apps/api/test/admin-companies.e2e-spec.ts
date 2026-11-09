import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type {
  AdminCompany,
  ApiError,
  AuthResponse,
  Paginated,
  RecruiterCompany,
} from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { adminSession, type AdminSession } from './utils/admin-session';

describe('Admin duyệt công ty (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: AdminSession;
  const runId = Date.now();
  let counter = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
    admin = await adminSession(app, dataSource);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-adco-${runId}%'`);
    await admin.cleanup();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const asAdmin = () => bearer(admin.token);

  async function newRecruiter(name: string): Promise<AuthResponse> {
    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: `e2e-adco-${runId}-${counter}@test.local`,
        password: 'abc12345',
        name: 'Chị HR',
        company: { translations: { vi: { name: `${name} ${runId}` } } },
      })
      .expect(201);
    return (res.body as { data: AuthResponse }).data;
  }

  const companyId = (session: AuthResponse) => session.user.companyId ?? '';

  it('chỉ admin gọi được: không token 401, nhà tuyển dụng 403', async () => {
    const recruiter = await newRecruiter('Quyền');
    await http().get('/api/v1/admin/companies').expect(401);
    await http().get('/api/v1/admin/companies').set(bearer(recruiter.accessToken)).expect(403);
  });

  it('lọc theo trạng thái và tên không dấu, có phân trang', async () => {
    await newRecruiter('Công ty Ánh Dương');
    await newRecruiter('Công ty Ánh Dương');

    const res = await http()
      .get(`/api/v1/admin/companies?status=PENDING&q=anh duong ${runId}&limit=1`)
      .set(asAdmin())
      .expect(200);
    const body = res.body as Paginated<AdminCompany>;
    expect(body.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      status: 'PENDING',
      owner: { email: expect.stringContaining(`e2e-adco-${runId}`) as unknown },
    });
  });

  it('limit quá 50 trả 400', async () => {
    const res = await http().get('/api/v1/admin/companies?limit=51').set(asAdmin()).expect(400);
    expect((res.body as ApiError).code).toBe('VALIDATION_FAILED');
  });

  it('duyệt: APPROVED, ghi approvedAt; duyệt lại vẫn 200', async () => {
    const recruiter = await newRecruiter('Duyệt');
    const approve = () =>
      http()
        .patch(`/api/v1/admin/companies/${companyId(recruiter)}/approve`)
        .set(asAdmin());

    const first = ((await approve().expect(200)).body as { data: AdminCompany }).data;
    expect(first.status).toBe('APPROVED');
    expect(first.approvedAt).not.toBeNull();

    const again = ((await approve().expect(200)).body as { data: AdminCompany }).data;
    expect(again.approvedAt).toBe(first.approvedAt);
  });

  it('từ chối cần lý do; nhà tuyển dụng thấy lý do, sửa xong về PENDING', async () => {
    const recruiter = await newRecruiter('Từ Chối');
    const reject = (body: object) =>
      http()
        .patch(`/api/v1/admin/companies/${companyId(recruiter)}/reject`)
        .set(asAdmin())
        .send(body);

    await reject({}).expect(400);
    const rejected = (
      (await reject({ reason: 'Thiếu mã số thuế' }).expect(200)).body as {
        data: AdminCompany;
      }
    ).data;
    expect(rejected).toMatchObject({ status: 'REJECTED', rejectReason: 'Thiếu mã số thuế' });

    const seen = (
      (await http().get('/api/v1/recruiter/company').set(bearer(recruiter.accessToken)).expect(200))
        .body as { data: RecruiterCompany }
    ).data;
    expect(seen.rejectReason).toBe('Thiếu mã số thuế');

    const resubmitted = (
      (
        await http()
          .put('/api/v1/recruiter/company')
          .set(bearer(recruiter.accessToken))
          .send({ translations: { vi: { name: `Đã bổ sung ${runId}` } } })
          .expect(200)
      ).body as { data: RecruiterCompany }
    ).data;
    expect(resubmitted).toMatchObject({ status: 'PENDING', rejectReason: null });
  });

  it('id không tồn tại trả 404, id sai định dạng trả 400', async () => {
    await http()
      .patch('/api/v1/admin/companies/00000000-0000-4000-8000-000000000000/approve')
      .set(asAdmin())
      .expect(404);
    await http().patch('/api/v1/admin/companies/abc/approve').set(asAdmin()).expect(400);
  });
});
