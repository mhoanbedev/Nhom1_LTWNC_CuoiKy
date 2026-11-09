import {
  decideRefresh,
  generateRefreshToken,
  hashRefreshToken,
  type RefreshTokenState,
} from './refresh-token.policy';

const NOW = new Date('2026-11-09T10:00:00.000Z');
const seconds = (n: number): Date => new Date(NOW.getTime() + n * 1000);

const token = (overrides: Partial<RefreshTokenState> = {}): RefreshTokenState => ({
  expiresAt: seconds(3600),
  revokedAt: null,
  replacedById: null,
  ...overrides,
});

describe('decideRefresh', () => {
  it('không có token trong DB thì invalid', () => {
    expect(decideRefresh(null, NOW, 30)).toBe('invalid');
  });

  it('token còn hiệu lực thì rotate', () => {
    expect(decideRefresh(token(), NOW, 30)).toBe('rotate');
  });

  it('hết hạn đúng lúc này thì invalid (biên expiresAt = now)', () => {
    expect(decideRefresh(token({ expiresAt: NOW }), NOW, 30)).toBe('invalid');
  });

  it('hết hạn thì invalid kể cả đã bị thu hồi', () => {
    expect(decideRefresh(token({ expiresAt: seconds(-1), revokedAt: seconds(-2) }), NOW, 30)).toBe(
      'invalid',
    );
  });

  it('vừa bị xoay trong 30 giây thì grace', () => {
    expect(decideRefresh(token({ revokedAt: seconds(-10), replacedById: 'new' }), NOW, 30)).toBe(
      'grace',
    );
  });

  it('bị xoay đúng 30 giây trước vẫn grace (biên)', () => {
    expect(decideRefresh(token({ revokedAt: seconds(-30), replacedById: 'new' }), NOW, 30)).toBe(
      'grace',
    );
  });

  it('bị xoay quá 30 giây thì reuse', () => {
    expect(decideRefresh(token({ revokedAt: seconds(-31), replacedById: 'new' }), NOW, 30)).toBe(
      'reuse',
    );
  });

  it('bị thu hồi do đăng xuất (không có token thay thế) thì reuse ngay', () => {
    expect(decideRefresh(token({ revokedAt: seconds(-1) }), NOW, 30)).toBe('reuse');
  });

  it('ân hạn 0 giây thì mọi lần dùng lại đều là reuse', () => {
    expect(decideRefresh(token({ revokedAt: seconds(-1), replacedById: 'new' }), NOW, 0)).toBe(
      'reuse',
    );
  });
});

describe('generateRefreshToken / hashRefreshToken', () => {
  it('token ngẫu nhiên, đủ dài, an toàn cho URL', () => {
    const a = generateRefreshToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(generateRefreshToken()).not.toBe(a);
  });

  it('hash cố định, 64 ký tự hex, khác token gốc', () => {
    const hash = hashRefreshToken('abc');
    expect(hash).toBe(hashRefreshToken('abc'));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(hashRefreshToken('abd'));
  });
});
