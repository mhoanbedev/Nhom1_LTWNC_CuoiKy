import type { ZodError } from 'zod';
import { createJobSchema, updateJobSchema } from './job.schema';

const SKILL_A = '11111111-1111-4111-8111-111111111111';
const SKILL_B = '22222222-2222-4222-8222-222222222222';
const vi = { title: 'Thực tập Backend NodeJS' };

/** Khóa dịch (`params.i18n`) của các lỗi validate tự đặt. */
const i18nKeys = (result: { error?: ZodError }) =>
  result.error?.issues.map((issue) => (issue as { params?: { i18n?: string } }).params?.i18n);

describe('createJobSchema', () => {
  it('chỉ cần bản vi có tiêu đề; điền mặc định cho phần còn lại', () => {
    expect(createJobSchema.parse({ translations: { vi } })).toMatchObject({
      workMode: 'ONSITE',
      isPaid: false,
      currency: 'VND',
      quantity: 1,
      skills: [],
    });
  });

  it('thiếu bản vi hoặc tiêu đề quá ngắn bị từ chối', () => {
    expect(createJobSchema.safeParse({ translations: {} }).success).toBe(false);
    expect(createJobSchema.safeParse({ translations: { vi: { title: 'abc' } } }).success).toBe(
      false,
    );
  });

  it('lương tối thiểu lớn hơn tối đa báo ở salaryMax', () => {
    const result = createJobSchema.safeParse({
      isPaid: true,
      salaryMin: 5_000_000,
      salaryMax: 3_000_000,
      translations: { vi },
    });
    expect(result.error?.issues[0]?.path).toEqual(['salaryMax']);
    expect(i18nKeys(result)).toEqual(['SALARY_MIN_GREATER_THAN_MAX']);
  });

  it('có lương mà isPaid=false bị từ chối', () => {
    const result = createJobSchema.safeParse({ salaryMin: 1, translations: { vi } });
    expect(i18nKeys(result)).toEqual(['SALARY_REQUIRES_PAID']);
  });

  it('kỹ năng trùng bị từ chối', () => {
    const result = createJobSchema.safeParse({
      skills: [{ skillId: SKILL_A }, { skillId: SKILL_A, isRequired: false }],
      translations: { vi },
    });
    expect(i18nKeys(result)).toEqual(['DUPLICATE_SKILL']);
  });

  it('isRequired mặc định là true', () => {
    const parsed = createJobSchema.parse({ skills: [{ skillId: SKILL_B }], translations: { vi } });
    expect(parsed.skills).toEqual([{ skillId: SKILL_B, isRequired: true }]);
  });

  it('expiresAt phải là ISO datetime có múi giờ', () => {
    expect(
      createJobSchema.safeParse({ expiresAt: '2026-12-31T23:59:59+07:00', translations: { vi } })
        .success,
    ).toBe(true);
    expect(
      createJobSchema.safeParse({ expiresAt: '31/12/2026', translations: { vi } }).success,
    ).toBe(false);
  });
});

describe('updateJobSchema', () => {
  it('gửi một trường là đủ, không điền mặc định cho trường không gửi', () => {
    expect(updateJobSchema.parse({ quantity: 3 })).toEqual({ quantity: 3 });
  });

  it('body rỗng bị từ chối với khóa AT_LEAST_ONE_FIELD', () => {
    expect(i18nKeys(updateJobSchema.safeParse({}))).toEqual(['AT_LEAST_ONE_FIELD']);
  });
});
