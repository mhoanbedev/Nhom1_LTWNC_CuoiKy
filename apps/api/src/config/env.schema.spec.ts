import { validateEnv } from './env.schema';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '4000',
  FRONTEND_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://ltwnc:ltwnc@localhost:5435/ltwnc',
};

describe('validateEnv', () => {
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
});
