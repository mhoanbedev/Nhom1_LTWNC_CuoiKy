import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

const run = (value: unknown): Promise<unknown> => {
  const next: CallHandler = { handle: () => of(value) };
  return lastValueFrom(new TransformInterceptor().intercept({} as ExecutionContext, next));
};

describe('TransformInterceptor', () => {
  it('bọc kết quả thường thành { data }', async () => {
    await expect(run({ id: 1 })).resolves.toEqual({ data: { id: 1 } });
    await expect(run([1, 2])).resolves.toEqual({ data: [1, 2] });
    await expect(run(null)).resolves.toEqual({ data: null });
  });

  it('giữ nguyên kết quả phân trang { data, meta }', async () => {
    const page = { data: [1], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } };
    await expect(run(page)).resolves.toBe(page);
  });

  it('giữ nguyên file', async () => {
    const file = new StreamableFile(Buffer.from('x'));
    await expect(run(file)).resolves.toBe(file);
  });
});
