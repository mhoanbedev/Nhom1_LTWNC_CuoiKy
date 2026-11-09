import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { LocationItem, SkillItem } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';

describe('/meta (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    // Seed danh mục chạy lại được và không xóa gì, nên chạy luôn trên DB dev.
    await seedCatalogs(app.get<DataSource>(getDataSourceToken()).manager);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('GET /meta/locations trả 34 tỉnh/thành, không cần đăng nhập, cache 1 ngày', async () => {
    const res = await http().get('/api/v1/meta/locations').expect(200);
    const items = (res.body as { data: LocationItem[] }).data;
    expect(items).toHaveLength(34);
    expect(items).toContainEqual(
      expect.objectContaining({ code: 'ho-chi-minh', name: 'TP. Hồ Chí Minh' }),
    );
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
  });

  it('?lang=en trả tên tiếng Anh', async () => {
    const res = await http().get('/api/v1/meta/locations?lang=en').expect(200);
    const items = (res.body as { data: LocationItem[] }).data;
    expect(items).toContainEqual(expect.objectContaining({ code: 'ha-noi', name: 'Hanoi' }));
  });

  it('GET /meta/skills theo Accept-Language', async () => {
    const res = await http().get('/api/v1/meta/skills').set('Accept-Language', 'en').expect(200);
    const items = (res.body as { data: SkillItem[] }).data;
    expect(items).toContainEqual(expect.objectContaining({ slug: 'teamwork', name: 'Teamwork' }));
    expect(items.length).toBeGreaterThanOrEqual(55);
  });

  it('GET /meta/industries trả danh sách ngành', async () => {
    const res = await http().get('/api/v1/meta/industries').expect(200);
    expect((res.body as { data: unknown[] }).data.length).toBeGreaterThan(0);
  });
});
