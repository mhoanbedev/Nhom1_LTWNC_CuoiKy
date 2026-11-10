import { toSitemapEntries, type TranslationRow } from './seo-entries';

const at = (iso: string) => new Date(iso);

describe('toSitemapEntries', () => {
  it('mỗi trang một phần tử, vi đứng trước, giữ thứ tự trang', () => {
    const rows: TranslationRow[] = [
      {
        id: 'job-2',
        updatedAt: at('2026-11-02T00:00:00Z'),
        locale: 'en',
        slug: 'backend-intern-b2',
        translationUpdatedAt: at('2026-11-01T00:00:00Z'),
      },
      {
        id: 'job-2',
        updatedAt: at('2026-11-02T00:00:00Z'),
        locale: 'vi',
        slug: 'thuc-tap-backend-b2',
        translationUpdatedAt: at('2026-11-01T00:00:00Z'),
      },
      {
        id: 'job-1',
        updatedAt: at('2026-11-01T00:00:00Z'),
        locale: 'vi',
        slug: 'thuc-tap-frontend-a1',
        translationUpdatedAt: at('2026-11-01T00:00:00Z'),
      },
    ];
    expect(toSitemapEntries('job', rows)).toEqual([
      {
        type: 'job',
        id: 'job-2',
        updatedAt: '2026-11-02T00:00:00.000Z',
        alternates: [
          { locale: 'vi', slug: 'thuc-tap-backend-b2' },
          { locale: 'en', slug: 'backend-intern-b2' },
        ],
      },
      {
        type: 'job',
        id: 'job-1',
        updatedAt: '2026-11-01T00:00:00.000Z',
        alternates: [{ locale: 'vi', slug: 'thuc-tap-frontend-a1' }],
      },
    ]);
  });

  it('bản dịch sửa sau bản ghi thì updatedAt lấy mốc của bản dịch', () => {
    const [entry] = toSitemapEntries('company', [
      {
        id: 'c1',
        updatedAt: at('2026-11-01T00:00:00Z'),
        locale: 'vi',
        slug: 'cong-ty-a',
        translationUpdatedAt: at('2026-11-01T00:00:00Z'),
      },
      {
        id: 'c1',
        updatedAt: at('2026-11-01T00:00:00Z'),
        locale: 'en',
        slug: 'company-a',
        translationUpdatedAt: at('2026-11-05T08:00:00Z'),
      },
    ]);
    expect(entry?.updatedAt).toBe('2026-11-05T08:00:00.000Z');
  });

  it('không có dòng nào thì rỗng', () => {
    expect(toSitemapEntries('job', [])).toEqual([]);
  });
});
