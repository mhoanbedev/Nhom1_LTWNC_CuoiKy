import { ErrorCode, LOCALES } from '@ltwnc/shared';
import en from './en/errors.json';
import vi from './vi/errors.json';

const FILES: Record<(typeof LOCALES)[number], Record<string, string>> = { vi, en };
const placeholders = (text: string): string[] => (text.match(/\{\w+\}/g) ?? []).sort();

describe('File dịch errors.json', () => {
  const codes = Object.values(ErrorCode);

  it.each(LOCALES)('%s có đủ mọi mã lỗi và không thừa mã lạ', (locale) => {
    expect(Object.keys(FILES[locale]).sort()).toEqual([...codes].sort());
  });

  it.each(codes)('%s có cùng tham số {…} ở vi và en', (code) => {
    expect(placeholders(FILES.en[code] ?? '')).toEqual(placeholders(FILES.vi[code] ?? ''));
  });
});
