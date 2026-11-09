import MarkdownIt from 'markdown-it';

/**
 * Markdown do nhà tuyển dụng viết → HTML an toàn để frontend render thẳng (`descriptionHtml`).
 * markdown-it với `html: false` không cho HTML thô (`<script>` thành chữ thường) và mặc định chặn
 * link `javascript:`, `vbscript:`, `data:` (trừ ảnh), nên đầu ra không chứa mã chạy được.
 */
const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });

// Link ra ngoài mở tab mới, không chuyển quyền cho trang đích, không truyền điểm SEO.
markdown.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  const token = tokens[index];
  if (token) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer nofollow');
  }
  return self.renderToken(tokens, index, options);
};

// Không nhận ảnh trong nội dung tin (ảnh ngoài có thể dùng để theo dõi người xem).
markdown.disable('image');

export function renderMarkdown(source: string | null): string | null {
  if (!source) return null;
  return markdown.render(source).trim();
}
