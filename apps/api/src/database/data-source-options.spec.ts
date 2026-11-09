import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { buildDataSourceOptions } from './data-source-options';

describe('buildDataSourceOptions', () => {
  const url = 'postgresql://u:p@localhost:5435/db';
  const options = buildDataSourceOptions(url);

  it('dùng PostgreSQL với chuỗi kết nối được truyền vào', () => {
    expect(options.type).toBe('postgres');
    expect(options).toMatchObject({ url });
  });

  it('luôn tắt synchronize để mọi thay đổi schema đi qua migration', () => {
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
  });

  it('đặt tên bảng và cột theo snake_case', () => {
    expect(options.namingStrategy).toBeInstanceOf(SnakeNamingStrategy);
  });
});
