import { ApplicationStatus, isApplicationStatus } from './enums';
import { DEFAULT_LOCALE, isLocale } from './locale';

describe('isLocale', () => {
  it.each(['vi', 'en'])('nhận %s', (value) => {
    expect(isLocale(value)).toBe(true);
  });

  it.each(['fr', 'VI', '', null, undefined, 1])('từ chối %p', (value) => {
    expect(isLocale(value)).toBe(false);
  });

  it('mặc định là vi', () => {
    expect(DEFAULT_LOCALE).toBe('vi');
  });
});

describe('isApplicationStatus', () => {
  it('nhận mọi giá trị của ApplicationStatus', () => {
    for (const status of Object.values(ApplicationStatus)) {
      expect(isApplicationStatus(status)).toBe(true);
    }
  });

  it.each(['submitted', 'DONE', '', null, 0])('từ chối %p', (value) => {
    expect(isApplicationStatus(value)).toBe(false);
  });
});
