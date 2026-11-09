import { INDUSTRIES } from './industries';
import { LOCATIONS } from './locations';
import { SKILLS } from './skills';

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function expectUnique(values: string[]): void {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  expect(duplicates).toEqual([]);
}

describe('dữ liệu seed danh mục', () => {
  it('có đúng 34 tỉnh/thành (sau sắp xếp năm 2025)', () => {
    expect(LOCATIONS).toHaveLength(34);
  });

  it('kỹ năng khoảng 60 mục như đặc tả', () => {
    expect(SKILLS.length).toBeGreaterThanOrEqual(55);
  });

  it.each([
    ['kỹ năng', SKILLS.map((s) => s.slug)],
    ['ngành', INDUSTRIES.map((s) => s.slug)],
    ['tỉnh/thành', LOCATIONS.map((s) => s.code)],
  ])('khoá của %s không trùng, dạng chữ thường không dấu nối bằng -', (_label, keys) => {
    expectUnique(keys);
    for (const key of keys) expect(key).toMatch(KEY_PATTERN);
  });

  it.each([
    ['kỹ năng', SKILLS],
    ['ngành', INDUSTRIES],
    ['tỉnh/thành', LOCATIONS],
  ])('%s có đủ tên hai ngôn ngữ, không trùng tên, vừa cột 100 ký tự', (_label, rows) => {
    for (const row of rows) {
      expect(row.nameVi.trim()).not.toBe('');
      expect(row.nameEn.trim()).not.toBe('');
      expect(row.nameVi.length).toBeLessThanOrEqual(100);
      expect(row.nameEn.length).toBeLessThanOrEqual(100);
    }
    expectUnique(rows.map((row) => row.nameVi));
    expectUnique(rows.map((row) => row.nameEn));
  });
});
