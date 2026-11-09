import { ErrorCode, LOCALES, ValidationMessage } from '@ltwnc/shared';
import enErrors from './en/errors.json';
import enValidation from './en/validation.json';
import viErrors from './vi/errors.json';
import viValidation from './vi/validation.json';

type Locale = (typeof LOCALES)[number];
type Messages = Record<string, string>;

const ERRORS: Record<Locale, Messages> = { vi: viErrors, en: enErrors };
const VALIDATION: Record<Locale, Messages> = { vi: viValidation, en: enValidation };
const placeholders = (text: string): string[] => (text.match(/\{\w+\}/g) ?? []).sort();

describe('File dịch errors.json', () => {
  const codes = Object.values(ErrorCode);

  it.each(LOCALES)('%s có đủ mọi mã lỗi và không thừa mã lạ', (locale) => {
    expect(Object.keys(ERRORS[locale]).sort()).toEqual([...codes].sort());
  });

  it.each(codes)('%s có cùng tham số {…} ở vi và en', (code) => {
    expect(placeholders(ERRORS.en[code] ?? '')).toEqual(placeholders(ERRORS.vi[code] ?? ''));
  });
});

describe('File dịch validation.json', () => {
  it.each(LOCALES)('%s có đủ mọi khóa ValidationMessage', (locale) => {
    expect(Object.keys(VALIDATION[locale]).sort()).toEqual(
      [...Object.values(ValidationMessage)].sort(),
    );
  });
});
