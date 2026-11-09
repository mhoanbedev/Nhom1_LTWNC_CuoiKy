import { isErrorCode } from '../errors/error-codes';
import { isPaginated } from './response';

describe('isPaginated', () => {
  it('nhận { data: [], meta } đủ 4 số', () => {
    expect(isPaginated({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } })).toBe(
      true,
    );
  });

  it.each([
    null,
    [],
    { data: [] },
    { data: {}, meta: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    { data: [], meta: { page: '1', limit: 20, total: 0, totalPages: 0 } },
  ])('từ chối %p', (value) => {
    expect(isPaginated(value)).toBe(false);
  });
});

describe('isErrorCode', () => {
  it('nhận mã có trong danh sách', () => {
    expect(isErrorCode('NOT_FOUND')).toBe(true);
  });

  it.each(['not_found', 'UNKNOWN', 404, null])('từ chối %p', (value) => {
    expect(isErrorCode(value)).toBe(false);
  });
});
