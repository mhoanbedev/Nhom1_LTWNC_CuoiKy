import { validateEnv } from './env.schema';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '4000',
  FRONTEND_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://ltwnc:ltwnc@localhost:5435/ltwnc',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  CLOUDINARY_API_KEY: 'test-key',
  CLOUDINARY_API_SECRET: 'test-secret',
};

describe('validateEnv', () => {
  it('báo lỗi khi JWT_ACCESS_SECRET ngắn hơn 32 ký tự', () => {
    expect(() => validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'ngan' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('mặc định JWT_ACCESS_EXPIRES_IN là 15m và từ chối dạng sai', () => {
    expect(validateEnv(validEnv).JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(() => validateEnv({ ...validEnv, JWT_ACCESS_EXPIRES_IN: '15 phút' })).toThrow(
      /JWT_ACCESS_EXPIRES_IN/,
    );
  });

  it('chấp nhận env hợp lệ và ép PORT thành số', () => {
    const env = validateEnv(validEnv);
    expect(env.PORT).toBe(4000);
    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it('điền mặc định cho NODE_ENV và PORT khi thiếu', () => {
    const { NODE_ENV: _nodeEnv, PORT: _port, ...rest } = validEnv;
    const env = validateEnv(rest);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
  });

  it('báo lỗi khi thiếu DATABASE_URL', () => {
    const { DATABASE_URL: _databaseUrl, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('báo lỗi khi DATABASE_URL không phải chuỗi PostgreSQL', () => {
    expect(() => validateEnv({ ...validEnv, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('báo lỗi khi PORT không phải số', () => {
    expect(() => validateEnv({ ...validEnv, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('báo lỗi khi FRONTEND_URL không phải URL', () => {
    expect(() => validateEnv({ ...validEnv, FRONTEND_URL: 'localhost' })).toThrow(/FRONTEND_URL/);
  });

  it('liệt kê mọi biến sai trong một lần báo lỗi', () => {
    expect(() => validateEnv({})).toThrow(/FRONTEND_URL[\s\S]*DATABASE_URL/);
  });

  it('REVALIDATE_URL để trống thì coi như tắt webhook', () => {
    const env = validateEnv({ ...validEnv, REVALIDATE_URL: '', REVALIDATE_SECRET: '' });
    expect(env.REVALIDATE_URL).toBeUndefined();
  });

  it('có REVALIDATE_URL thì bắt buộc REVALIDATE_SECRET', () => {
    expect(() =>
      validateEnv({ ...validEnv, REVALIDATE_URL: 'http://localhost:3000/api/revalidate' }),
    ).toThrow(/REVALIDATE_SECRET/);
    expect(
      validateEnv({
        ...validEnv,
        REVALIDATE_URL: 'http://localhost:3000/api/revalidate',
        REVALIDATE_SECRET: 'x'.repeat(16),
      }).REVALIDATE_URL,
    ).toBe('http://localhost:3000/api/revalidate');
  });

  it('production bắt buộc REVALIDATE_URL, dev thì không', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'production' })).toThrow(/REVALIDATE_URL/);
    expect(
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        REVALIDATE_URL: 'https://web.example.com/api/revalidate',
        REVALIDATE_SECRET: 'x'.repeat(32),
      }).NODE_ENV,
    ).toBe('production');
    expect(validateEnv({ ...validEnv, NODE_ENV: 'development' }).REVALIDATE_URL).toBeUndefined();
  });
});
