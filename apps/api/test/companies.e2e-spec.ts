import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { ApiError, AuthResponse, RecruiterCompany } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { CloudinaryService } from '../src/infrastructure/cloudinary/cloudinary.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

/** Cloudinary giả: không gọi mạng, ghi lại ảnh đã xóa. */
class FakeCloudinary {
  uploads = 0;
  deleted: string[] = [];
  uploadImage() {
    this.uploads += 1;
    return Promise.resolve({
      url: `https://cdn.test/logo-${this.uploads}.png`,
      publicId: `logos/fake-${this.uploads}`,
    });
  }
  deleteImage(publicId: string) {
    this.deleted.push(publicId);
    return Promise.resolve();
  }
}

describe('Công ty, đăng ký nhà tuyển dụng, logo (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const cloudinary = new FakeCloudinary();
  const runId = Date.now();
  let counter = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CloudinaryService)
      .useValue(cloudinary)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-co-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const nextEmail = () => `e2e-co-${runId}-${(counter += 1)}@test.local`;
  /** Tên riêng mỗi lần chạy để slug không đụng dữ liệu cũ trong DB dev. */
  const companyName = (label: string) => `Công ty ${label} ${runId}`;

  function registerRecruiter(company: object, email = nextEmail()) {
    return http()
      .post('/api/v1/auth/register/recruiter')
      .send({ email, password: 'abc12345', name: 'Chị HR', company });
  }

  async function newRecruiter(label: string): Promise<AuthResponse> {
    const res = await registerRecruiter({
      translations: { vi: { name: companyName(label) } },
    }).expect(201);
    return (res.body as { data: AuthResponse }).data;
  }

  const getCompany = async (token: string) =>
    (
      (await http().get('/api/v1/recruiter/company').set(bearer(token)).expect(200)).body as {
        data: RecruiterCompany;
      }
    ).data;

  describe('đăng ký nhà tuyển dụng', () => {
    it('tạo tài khoản RECRUITER và công ty PENDING, slug bỏ dấu', async () => {
      const session = await newRecruiter('Phần Mềm Á Đông');
      expect(session.user.role).toBe('RECRUITER');
      expect(session.user.companyId).toEqual(expect.any(String));

      const company = await getCompany(session.accessToken);
      expect(company).toMatchObject({
        id: session.user.companyId,
        status: 'PENDING',
        translations: {
          vi: { name: companyName('Phần Mềm Á Đông'), slug: `cong-ty-phan-mem-a-dong-${runId}` },
          en: null,
        },
      });
    });

    it('tên trùng thì slug thêm hậu tố -2', async () => {
      await newRecruiter('Trùng Tên');
      const second = await newRecruiter('Trùng Tên');
      const company = await getCompany(second.accessToken);
      expect(company.translations.vi.slug).toBe(`cong-ty-trung-ten-${runId}-2`);
    });

    it('industryId không tồn tại: 400 INVALID_REFERENCE và không để lại tài khoản', async () => {
      const email = nextEmail();
      const res = await registerRecruiter(
        {
          industryId: '00000000-0000-4000-8000-000000000000',
          translations: { vi: { name: companyName('Sai Ngành') } },
        },
        email,
      ).expect(400);
      expect((res.body as ApiError).code).toBe('INVALID_REFERENCE');
      const rows = await dataSource.query<unknown[]>(`SELECT 1 FROM users WHERE email = $1`, [
        email,
      ]);
      expect(rows).toHaveLength(0);
    });

    it('thiếu bản vi trả 400 VALIDATION_FAILED', async () => {
      const res = await registerRecruiter({ translations: {} }).expect(400);
      expect((res.body as ApiError).code).toBe('VALIDATION_FAILED');
    });
  });

  describe('sửa công ty', () => {
    it('thêm bản en (có slug riêng), đổi tên vi thì slug vi giữ nguyên, bỏ en là xóa', async () => {
      const session = await newRecruiter('Sửa');
      const before = await getCompany(session.accessToken);

      const put = (body: object) =>
        http().put('/api/v1/recruiter/company').set(bearer(session.accessToken)).send(body);

      const withEn = (
        (
          await put({
            website: 'https://abc.example.com',
            size: '11-50',
            address: '  ',
            translations: {
              vi: { name: 'Tên mới hoàn toàn', description: 'Giới thiệu' },
              en: { name: `ABC Software ${runId}` },
            },
          }).expect(200)
        ).body as { data: RecruiterCompany }
      ).data;
      expect(withEn).toMatchObject({
        website: 'https://abc.example.com',
        size: '11-50',
        address: null,
        translations: {
          vi: { name: 'Tên mới hoàn toàn', slug: before.translations.vi.slug },
          en: { slug: `abc-software-${runId}` },
        },
      });

      const withoutEn = (
        (await put({ translations: { vi: { name: 'Tên mới hoàn toàn' } } }).expect(200)).body as {
          data: RecruiterCompany;
        }
      ).data;
      expect(withoutEn.translations.en).toBeNull();
      expect(withoutEn.website).toBeNull();
    });

    it('công ty bị từ chối sửa xong tự về PENDING, xóa lý do từ chối', async () => {
      const session = await newRecruiter('Bị Từ Chối');
      await dataSource.query(
        `UPDATE companies SET status = 'REJECTED', reject_reason = 'Thiếu thông tin' WHERE id = $1`,
        [session.user.companyId],
      );
      const res = await http()
        .put('/api/v1/recruiter/company')
        .set(bearer(session.accessToken))
        .send({ translations: { vi: { name: 'Đã bổ sung' } } })
        .expect(200);
      expect((res.body as { data: RecruiterCompany }).data).toMatchObject({
        status: 'PENDING',
        rejectReason: null,
      });
    });

    it('ứng viên gọi API nhà tuyển dụng trả 403', async () => {
      const res = await http()
        .post('/api/v1/auth/register/candidate')
        .send({ email: nextEmail(), password: 'abc12345', name: 'Ứng Viên' })
        .expect(201);
      const token = (res.body as { data: AuthResponse }).data.accessToken;
      await http().get('/api/v1/recruiter/company').set(bearer(token)).expect(403);
    });
  });

  describe('logo', () => {
    it('upload ảnh: lưu URL, lần sau xóa logo cũ', async () => {
      const session = await newRecruiter('Logo');
      const upload = () =>
        http()
          .post('/api/v1/recruiter/company/logo')
          .set(bearer(session.accessToken))
          .attach('file', PNG, { filename: 'logo.png', contentType: 'image/png' });

      const first = (await upload().expect(200)).body as { data: { logoUrl: string } };
      expect(first.data.logoUrl).toMatch(/^https:\/\/cdn\.test\/logo-\d+\.png$/);
      expect((await getCompany(session.accessToken)).logoUrl).toBe(first.data.logoUrl);

      const deletedBefore = cloudinary.deleted.length;
      await upload().expect(200);
      expect(cloudinary.deleted.length).toBe(deletedBefore + 1);
    });

    it('file không phải ảnh (đổi đuôi .png) trả 400 FILE_INVALID_TYPE', async () => {
      const session = await newRecruiter('Logo Sai');
      const res = await http()
        .post('/api/v1/recruiter/company/logo?lang=vi')
        .set(bearer(session.accessToken))
        .attach('file', Buffer.from('%PDF-1.4 không phải ảnh'), {
          filename: 'gia.png',
          contentType: 'image/png',
        })
        .expect(400);
      expect(res.body as ApiError).toMatchObject({
        code: 'FILE_INVALID_TYPE',
        message: 'Định dạng file không hợp lệ, chỉ nhận JPG, PNG, WebP',
      });
    });

    it('ảnh quá 2 MB trả 400 FILE_TOO_LARGE kèm số MB', async () => {
      const session = await newRecruiter('Logo To');
      const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 + 10)]);
      const res = await http()
        .post('/api/v1/recruiter/company/logo?lang=en')
        .set(bearer(session.accessToken))
        .attach('file', big, { filename: 'to.png', contentType: 'image/png' })
        .expect(400);
      expect(res.body as ApiError).toMatchObject({
        code: 'FILE_TOO_LARGE',
        message: 'The file exceeds 2 MB',
      });
    });

    it('không gửi file trả 400', async () => {
      const session = await newRecruiter('Không File');
      const res = await http()
        .post('/api/v1/recruiter/company/logo')
        .set(bearer(session.accessToken))
        .expect(400);
      expect((res.body as ApiError).code).toBe('FILE_INVALID_TYPE');
    });
  });
});
