import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { ApiError, AuthResponse, CvFile } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { CloudinaryService } from '../src/infrastructure/cloudinary/cloudinary.service';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\n%%EOF');

/** Cloudinary giả cho file riêng tư: không gọi mạng, ghi lại file đã upload và đã xóa. */
class FakeCloudinary {
  uploaded: string[] = [];
  deleted: string[] = [];
  uploadPrivateFile(buffer: Buffer, options: { folder: string; fileName: string }) {
    const publicId = `${options.folder}/${options.fileName}`;
    this.uploaded.push(publicId);
    return Promise.resolve({ publicId, bytes: buffer.length });
  }
  deletePrivateFile(publicId: string) {
    this.deleted.push(publicId);
    return Promise.resolve();
  }
}

describe('CV: upload, mặc định, xóa (e2e)', () => {
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
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-cv-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });

  async function newCandidate(): Promise<AuthResponse> {
    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: `e2e-cv-${runId}-${counter}@test.local`, password: 'abc12345', name: 'An' })
      .expect(201);
    return (res.body as { data: AuthResponse }).data;
  }

  const upload = (
    session: AuthResponse,
    file: Buffer = PDF,
    filename = 'cv.pdf',
    contentType = 'application/pdf',
  ) =>
    http()
      .post('/api/v1/me/cvs')
      .set(bearer(session))
      .attach('file', file, { filename, contentType });

  const cvOf = (res: request.Response) => (res.body as { data: CvFile }).data;
  const list = async (session: AuthResponse) =>
    (
      (await http().get('/api/v1/me/cvs').set(bearer(session)).expect(200)).body as {
        data: CvFile[];
      }
    ).data;

  it('CV đầu tiên tự thành mặc định; giữ đúng tên file tiếng Việt; mới nhất lên trước', async () => {
    const candidate = await newCandidate();
    const first = cvOf(await upload(candidate, PDF, 'CV Nguyễn An.pdf').expect(201));
    expect(first).toMatchObject({
      originalName: 'CV Nguyễn An.pdf',
      isDefault: true,
      size: PDF.length,
    });
    const second = cvOf(await upload(candidate).expect(201));
    expect(second.isDefault).toBe(false);
    expect((await list(candidate)).map((cv) => cv.id)).toEqual([second.id, first.id]);
  });

  it('file lưu riêng theo ứng viên trên Cloudinary, response không lộ public id', async () => {
    const candidate = await newCandidate();
    const cv = cvOf(await upload(candidate).expect(201));
    expect(cloudinary.uploaded.at(-1)).toMatch(
      new RegExp(`^cvs/${candidate.user.id}/[0-9a-f-]{36}\\.pdf$`),
    );
    expect(cv).not.toHaveProperty('cloudinaryPublicId');
  });

  it.each([
    [
      'nội dung không phải PDF dù đuôi .pdf',
      Buffer.from('MZ fake exe'),
      'cv.pdf',
      'application/pdf',
    ],
    [
      'file Word',
      PDF,
      'cv.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  ])('%s: 400 FILE_INVALID_TYPE', async (_label, file, filename, contentType) => {
    const candidate = await newCandidate();
    const res = await upload(candidate, file, filename, contentType).expect(400);
    expect(res.body as ApiError).toMatchObject({
      code: 'FILE_INVALID_TYPE',
      message: 'Định dạng file không hợp lệ, chỉ nhận PDF',
    });
  });

  it('quá 5 MB: 400 FILE_TOO_LARGE', async () => {
    const candidate = await newCandidate();
    const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await upload(candidate, big).expect(400);
    expect(res.body as ApiError).toMatchObject({
      code: 'FILE_TOO_LARGE',
      message: 'File vượt quá 5 MB',
    });
  });

  it('tối đa 5 CV: cái thứ 6 trả 400 CV_LIMIT_REACHED; xóa bớt thì upload lại được', async () => {
    const candidate = await newCandidate();
    for (let i = 0; i < 5; i += 1) await upload(candidate).expect(201);
    const res = await upload(candidate).expect(400);
    expect(res.body as ApiError).toMatchObject({
      code: 'CV_LIMIT_REACHED',
      message: 'Bạn đã có tối đa 5 CV',
    });
    const [oldest] = (await list(candidate)).slice(-1);
    await http().delete(`/api/v1/me/cvs/${oldest?.id}`).set(bearer(candidate)).expect(204);
    await upload(candidate).expect(201);
  });

  it('upload đồng thời không vượt 5 CV, file của request thua được dọn', async () => {
    const candidate = await newCandidate();
    const uploadedBefore = cloudinary.uploaded.length;
    const deletedBefore = cloudinary.deleted.length;
    const results = await Promise.all(Array.from({ length: 7 }, () => upload(candidate)));
    expect(results.filter((res) => res.status === 201)).toHaveLength(5);
    expect(results.filter((res) => res.status === 400)).toHaveLength(2);
    expect(await list(candidate)).toHaveLength(5);
    // Mỗi file đã lên Cloudinary hoặc được lưu vào DB, hoặc đã bị dọn: không có file mồ côi.
    const uploaded = cloudinary.uploaded.length - uploadedBefore;
    const deleted = cloudinary.deleted.length - deletedBefore;
    expect(uploaded - deleted).toBe(5);
  });

  it('đặt mặc định: chỉ một CV mặc định', async () => {
    const candidate = await newCandidate();
    const first = cvOf(await upload(candidate).expect(201));
    const second = cvOf(await upload(candidate).expect(201));
    const res = await http()
      .patch(`/api/v1/me/cvs/${second.id}/default`)
      .set(bearer(candidate))
      .expect(200);
    expect(cvOf(res).isDefault).toBe(true);
    const all = await list(candidate);
    expect(all.filter((cv) => cv.isDefault).map((cv) => cv.id)).toEqual([second.id]);
    expect(all.find((cv) => cv.id === first.id)?.isDefault).toBe(false);
  });

  it('xóa CV mặc định: CV mới nhất còn lại thành mặc định; xóa lần nữa 404; file vẫn giữ', async () => {
    const candidate = await newCandidate();
    const oldest = cvOf(await upload(candidate).expect(201));
    const middle = cvOf(await upload(candidate).expect(201));
    const newest = cvOf(await upload(candidate).expect(201));
    const deletedBefore = cloudinary.deleted.length;

    await http().delete(`/api/v1/me/cvs/${oldest.id}`).set(bearer(candidate)).expect(204);
    const remaining = await list(candidate);
    expect(remaining.map((cv) => [cv.id, cv.isDefault])).toEqual([
      [newest.id, true],
      [middle.id, false],
    ]);
    await http().delete(`/api/v1/me/cvs/${oldest.id}`).set(bearer(candidate)).expect(404);
    expect(cloudinary.deleted.length).toBe(deletedBefore);
  });

  it('CV của người khác: 404; nhà tuyển dụng gọi: 403', async () => {
    const owner = await newCandidate();
    const cv = cvOf(await upload(owner).expect(201));
    const other = await newCandidate();
    await http().patch(`/api/v1/me/cvs/${cv.id}/default`).set(bearer(other)).expect(404);
    await http().delete(`/api/v1/me/cvs/${cv.id}`).set(bearer(other)).expect(404);

    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: `e2e-cv-${runId}-${counter}@test.local`,
        password: 'abc12345',
        name: 'HR',
        company: { translations: { vi: { name: `Công ty CV ${runId}` } } },
      })
      .expect(201);
    const recruiter = (res.body as { data: AuthResponse }).data;
    await http().get('/api/v1/me/cvs').set(bearer(recruiter)).expect(403);
  });
});
