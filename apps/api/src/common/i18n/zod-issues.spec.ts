import { z } from 'zod';
import { zodIssuesToDetails } from './zod-issues';

const schema = z.object({
  name: z.string().min(2),
  education: z.array(z.object({ school: z.string() })),
});

function errorOf(input: unknown): z.ZodError {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('Mong đợi lỗi validate');
  return result.error;
}

describe('zodIssuesToDetails', () => {
  const error = errorOf({ name: 'a', education: [{ school: 1 }] });

  it('ghi field theo đường dẫn, mảng dùng chỉ số', () => {
    expect(zodIssuesToDetails(error, 'vi').map((d) => d.field)).toEqual([
      'name',
      'education.0.school',
    ]);
  });

  it('dịch câu báo theo ngôn ngữ', () => {
    const vi = zodIssuesToDetails(error, 'vi')[0]?.message;
    const en = zodIssuesToDetails(error, 'en')[0]?.message;
    expect(en).toMatch(/too small/i);
    expect(vi).toBeTruthy();
    expect(vi).not.toBe(en);
  });
});
