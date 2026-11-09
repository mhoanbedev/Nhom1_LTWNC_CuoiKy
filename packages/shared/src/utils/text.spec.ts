import { normalizeSearchText, removeVietnameseTones, slugify } from './text';

describe('removeVietnameseTones', () => {
  it('bỏ mọi dấu, kể cả đ/Đ', () => {
    expect(removeVietnameseTones('Thực tập Đà Nẵng, Hồ Chí Minh, Huế, Quảng Ngãi')).toBe(
      'Thuc tap Da Nang, Ho Chi Minh, Hue, Quang Ngai',
    );
  });

  it('chuỗi đã soạn sẵn dạng NFD vẫn bỏ được dấu', () => {
    expect(removeVietnameseTones('Thực'.normalize('NFD'))).toBe('Thuc');
  });
});

describe('slugify', () => {
  it.each([
    ['Thực tập Backend Node.js', 'thuc-tap-backend-node-js'],
    ['  Công ty TNHH Phần mềm ABC  ', 'cong-ty-tnhh-phan-mem-abc'],
    ['Đội ngũ C# / .NET', 'doi-ngu-c-net'],
    ['React & Next.js (2026)', 'react-next-js-2026'],
    ['---', ''],
    ['', ''],
  ])('"%s" → "%s"', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('cắt ở ranh giới từ khi quá dài, không để dấu - ở cuối', () => {
    const slug = slugify('thuc tap sinh lap trinh vien backend nodejs', 20);
    expect(slug).toBe('thuc-tap-sinh-lap');
    expect(slug.length).toBeLessThanOrEqual(20);
  });

  it('một từ dài hơn giới hạn thì cắt cứng', () => {
    expect(slugify('a'.repeat(30), 10)).toBe('a'.repeat(10));
  });
});

describe('normalizeSearchText', () => {
  it('bỏ dấu, viết thường, gộp khoảng trắng', () => {
    expect(normalizeSearchText('  Thực   Tập\nBackend ')).toBe('thuc tap backend');
  });
});
