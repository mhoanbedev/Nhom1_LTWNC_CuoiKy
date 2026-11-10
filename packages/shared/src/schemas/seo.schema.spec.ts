import { seoStaticParamsQuerySchema } from './seo.schema';

describe('seoStaticParamsQuerySchema', () => {
  it('type bắt buộc, limit mặc định 100', () => {
    expect(seoStaticParamsQuerySchema.parse({ type: 'job' })).toEqual({ type: 'job', limit: 100 });
    expect(seoStaticParamsQuerySchema.parse({ type: 'company', limit: '20' }).limit).toBe(20);
    expect(seoStaticParamsQuerySchema.safeParse({}).success).toBe(false);
  });

  it('type lạ hoặc limit ngoài 1–1000 bị từ chối', () => {
    expect(seoStaticParamsQuerySchema.safeParse({ type: 'skill' }).success).toBe(false);
    expect(seoStaticParamsQuerySchema.safeParse({ type: 'job', limit: '0' }).success).toBe(false);
    expect(seoStaticParamsQuerySchema.safeParse({ type: 'job', limit: '1001' }).success).toBe(
      false,
    );
  });
});
