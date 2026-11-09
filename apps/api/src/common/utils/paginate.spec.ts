import { paginate, toSkipTake } from './paginate';

describe('paginate', () => {
  it('tính skip/take từ page và limit', () => {
    expect(toSkipTake({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 });
    expect(toSkipTake({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 });
  });

  it('gói kết quả kèm meta, làm tròn lên số trang', () => {
    expect(paginate(['a', 'b'], 21, { page: 2, limit: 10 })).toEqual({
      data: ['a', 'b'],
      meta: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
  });

  it('không có bản ghi nào thì 0 trang', () => {
    expect(paginate([], 0, { page: 1, limit: 20 }).meta.totalPages).toBe(0);
  });
});
