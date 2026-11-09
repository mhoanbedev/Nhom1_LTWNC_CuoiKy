import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('render định dạng cơ bản', () => {
    expect(renderMarkdown('## Mô tả\n- **Làm API**\n- Viết test')).toBe(
      '<h2>Mô tả</h2>\n<ul>\n<li><strong>Làm API</strong></li>\n<li>Viết test</li>\n</ul>',
    );
  });

  it('HTML thô không chạy được (thành chữ thường)', () => {
    const html = renderMarkdown('<script>alert(1)</script><img src=x onerror=alert(1)>') ?? '';
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('không tạo link javascript:', () => {
    expect(renderMarkdown('[xấu](javascript:alert(1))')).not.toContain('href="javascript:');
  });

  it('link https mở tab mới kèm rel an toàn', () => {
    expect(renderMarkdown('[web](https://abc.vn)')).toBe(
      '<p><a href="https://abc.vn" target="_blank" rel="noopener noreferrer nofollow">web</a></p>',
    );
  });

  it('không render ảnh', () => {
    expect(renderMarkdown('![x](https://abc.vn/a.png)')).not.toContain('<img');
  });

  it('rỗng hoặc null thì trả null', () => {
    expect(renderMarkdown(null)).toBeNull();
    expect(renderMarkdown('')).toBeNull();
  });
});
