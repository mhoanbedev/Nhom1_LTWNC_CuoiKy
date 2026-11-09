import { resolveLocale } from './resolve-locale';

describe('resolveLocale', () => {
  it('ưu tiên query ?lang', () => {
    expect(resolveLocale('en', 'vi')).toBe('en');
    expect(resolveLocale('VI', 'en')).toBe('vi');
  });

  it('bỏ qua ?lang không hỗ trợ và xét Accept-Language', () => {
    expect(resolveLocale('fr', 'en-US,en;q=0.9')).toBe('en');
  });

  it('chọn ngôn ngữ hỗ trợ có trọng số q cao nhất', () => {
    expect(resolveLocale(undefined, 'fr;q=1, vi;q=0.5, en;q=0.8')).toBe('en');
    expect(resolveLocale(undefined, 'ja, vi-VN;q=0.9')).toBe('vi');
  });

  it('bỏ ngôn ngữ có q=0', () => {
    expect(resolveLocale(undefined, 'en;q=0')).toBe('vi');
  });

  it('mặc định vi khi không có gì khớp', () => {
    expect(resolveLocale(undefined, undefined)).toBe('vi');
    expect(resolveLocale(['en'], 'fr')).toBe('vi');
  });
});
