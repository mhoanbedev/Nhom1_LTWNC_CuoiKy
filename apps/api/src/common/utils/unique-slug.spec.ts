import { uniqueSlug } from './unique-slug';

describe('uniqueSlug', () => {
  const takenIn = (taken: string[]) => (slug: string) => Promise.resolve(taken.includes(slug));

  it('slug gốc còn trống thì dùng luôn', async () => {
    await expect(uniqueSlug('Công ty ABC', 'cong-ty', takenIn([]))).resolves.toBe('cong-ty-abc');
  });

  it('trùng thì thêm hậu tố -2, -3...', async () => {
    await expect(
      uniqueSlug('Công ty ABC', 'cong-ty', takenIn(['cong-ty-abc', 'cong-ty-abc-2'])),
    ).resolves.toBe('cong-ty-abc-3');
  });

  it('tên không có chữ hay số thì dùng fallback', async () => {
    await expect(uniqueSlug('!!!', 'cong-ty', takenIn([]))).resolves.toBe('cong-ty');
  });
});
