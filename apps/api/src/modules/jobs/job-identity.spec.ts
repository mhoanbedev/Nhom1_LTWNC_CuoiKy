import { generateShortId, jobSlug } from './recruiter-jobs.service';

describe('shortId và slug của tin', () => {
  it('shortId gồm 6 ký tự a-z0-9', () => {
    for (let i = 0; i < 50; i += 1) expect(generateShortId()).toMatch(/^[a-z0-9]{6}$/);
  });

  it('slug = tiêu đề không dấu + shortId', () => {
    expect(jobSlug('Thực tập Backend Node.js', 'a1b2c3', 'vi')).toBe(
      'thuc-tap-backend-node-js-a1b2c3',
    );
  });

  it('tiêu đề không có chữ hay số thì dùng chữ thay thế theo ngôn ngữ', () => {
    expect(jobSlug('!!!', 'a1b2c3', 'vi')).toBe('tin-tuyen-dung-a1b2c3');
    expect(jobSlug('!!!', 'a1b2c3', 'en')).toBe('job-a1b2c3');
  });

  it('slug vừa cột 120 ký tự dù tiêu đề rất dài', () => {
    expect(jobSlug('thực tập '.repeat(40), 'a1b2c3', 'vi').length).toBeLessThanOrEqual(120);
  });
});
