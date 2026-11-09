import type { ZodError } from 'zod';
import {
  basicProfileSchema,
  educationStepSchema,
  projectsStepSchema,
  skillsStepSchema,
} from './profile.schema';

const SKILL = '11111111-1111-4111-8111-111111111111';

/** Khóa dịch (`params.i18n`) của các lỗi validate tự đặt. */
const i18nKeys = (result: { error?: ZodError }) =>
  result.error?.issues.map((issue) => (issue as { params?: { i18n?: string } }).params?.i18n);

describe('basicProfileSchema', () => {
  it('chuẩn hóa số điện thoại, ô trống thành null, links mặc định rỗng', () => {
    expect(
      basicProfileSchema.parse({ headline: 'Sinh viên CNTT', phone: '091 234.5678', about: '  ' }),
    ).toEqual({ headline: 'Sinh viên CNTT', phone: '0912345678', about: null, links: [] });
  });

  it.each(['+84912345678', '0912345678', ''])('nhận số điện thoại "%s"', (phone) => {
    expect(basicProfileSchema.safeParse({ headline: 'abc', phone }).success).toBe(true);
  });

  it('số điện thoại sai báo khóa PHONE_INVALID', () => {
    expect(i18nKeys(basicProfileSchema.safeParse({ headline: 'abc', phone: '12345' }))).toEqual([
      'PHONE_INVALID',
    ]);
  });

  it('ngày sinh phải là ngày đã qua, đúng dạng YYYY-MM-DD', () => {
    expect(
      basicProfileSchema.safeParse({ headline: 'abc', dateOfBirth: '2004-05-20' }).success,
    ).toBe(true);
    expect(
      i18nKeys(basicProfileSchema.safeParse({ headline: 'abc', dateOfBirth: '2999-01-01' })),
    ).toEqual(['DATE_IN_PAST']);
    expect(
      basicProfileSchema.safeParse({ headline: 'abc', dateOfBirth: '20/05/2004' }).success,
    ).toBe(false);
  });
});

describe('educationStepSchema', () => {
  const item = { school: 'ĐH Bách Khoa', startDate: '2022-09' };

  it('cần ít nhất 1 dòng; endDate null là đang học', () => {
    expect(educationStepSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      educationStepSchema.parse({ items: [{ ...item, endDate: null }] }).items[0],
    ).toMatchObject({
      endDate: null,
    });
  });

  it('kết thúc trước bắt đầu báo ở endDate', () => {
    const result = educationStepSchema.safeParse({ items: [{ ...item, endDate: '2021-06' }] });
    expect(result.error?.issues[0]?.path).toEqual(['items', 0, 'endDate']);
    expect(i18nKeys(result)).toEqual(['END_BEFORE_START']);
  });

  it('tháng phải dạng YYYY-MM, GPA thang 4', () => {
    expect(
      educationStepSchema.safeParse({ items: [{ ...item, startDate: '2022-13' }] }).success,
    ).toBe(false);
    expect(educationStepSchema.safeParse({ items: [{ ...item, gpa: 4.5 }] }).success).toBe(false);
  });
});

describe('skillsStepSchema', () => {
  it('cần ít nhất 1 kỹ năng, mức 1-5, không trùng', () => {
    expect(skillsStepSchema.safeParse({ items: [] }).success).toBe(false);
    expect(skillsStepSchema.safeParse({ items: [{ skillId: SKILL, level: 6 }] }).success).toBe(
      false,
    );
    expect(
      i18nKeys(
        skillsStepSchema.safeParse({
          items: [
            { skillId: SKILL, level: 3 },
            { skillId: SKILL, level: 4 },
          ],
        }),
      ),
    ).toEqual(['DUPLICATE_SKILL']);
  });
});

describe('projectsStepSchema', () => {
  it('được gửi mảng rỗng (bước không bắt buộc)', () => {
    expect(projectsStepSchema.parse({ items: [] })).toEqual({ items: [] });
  });

  it('techStack mặc định rỗng, url phải hợp lệ', () => {
    expect(
      projectsStepSchema.parse({ items: [{ name: 'Web bán hàng' }] }).items[0]?.techStack,
    ).toEqual([]);
    expect(projectsStepSchema.safeParse({ items: [{ name: 'Web', url: 'abc' }] }).success).toBe(
      false,
    );
  });
});
