import { adminJobsQuerySchema, adminUsersQuerySchema, hideJobSchema } from './admin.schema';

describe('adminJobsQuerySchema', () => {
  it('điền phân trang mặc định, không lọc gì', () => {
    expect(adminJobsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('hidden đọc từ chuỗi true/false; q rỗng coi như không lọc', () => {
    expect(adminJobsQuerySchema.parse({ hidden: 'true', q: '  ' })).toMatchObject({
      hidden: true,
      q: undefined,
    });
    expect(adminJobsQuerySchema.parse({ hidden: 'false' }).hidden).toBe(false);
  });

  it('hidden hay status sai giá trị bị từ chối', () => {
    expect(adminJobsQuerySchema.safeParse({ hidden: 'yes' }).success).toBe(false);
    expect(adminJobsQuerySchema.safeParse({ status: 'HIDDEN' }).success).toBe(false);
  });
});

describe('hideJobSchema', () => {
  it('lý do được cắt khoảng trắng, phải dài 5–500 ký tự', () => {
    expect(hideJobSchema.parse({ reason: '  Tin lừa đảo  ' })).toEqual({ reason: 'Tin lừa đảo' });
    expect(hideJobSchema.safeParse({ reason: '  abc ' }).success).toBe(false);
    expect(hideJobSchema.safeParse({ reason: 'a'.repeat(501) }).success).toBe(false);
    expect(hideJobSchema.safeParse({}).success).toBe(false);
  });
});

describe('adminUsersQuerySchema', () => {
  it('lọc theo vai trò, trạng thái', () => {
    expect(adminUsersQuerySchema.parse({ role: 'RECRUITER', status: 'LOCKED' })).toMatchObject({
      role: 'RECRUITER',
      status: 'LOCKED',
    });
  });

  it('GUEST không phải vai trò lưu DB nên bị từ chối', () => {
    expect(adminUsersQuerySchema.safeParse({ role: 'GUEST' }).success).toBe(false);
  });
});
