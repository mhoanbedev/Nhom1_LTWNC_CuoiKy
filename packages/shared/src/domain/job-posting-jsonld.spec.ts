import type { PublicJobDetail } from '../api/public';
import { buildJobPostingJsonLd, serializeJsonLd } from './job-posting-jsonld';

const job: PublicJobDetail = {
  id: 'job-1',
  shortId: 'a1b2c3',
  locale: 'vi',
  slug: 'thuc-tap-backend-a1b2c3',
  canonicalSlug: 'thuc-tap-backend-a1b2c3',
  alternates: [{ locale: 'vi', slug: 'thuc-tap-backend-a1b2c3' }],
  title: 'Thực tập Backend',
  company: {
    id: 'company-1',
    locale: 'vi',
    slug: 'cong-ty-a',
    name: 'Công ty A',
    logoUrl: 'https://res.cloudinary.com/demo/logo.png',
    website: 'https://congtya.vn',
  },
  location: { id: 'hn', name: 'Hà Nội' },
  workMode: 'ONSITE',
  isPaid: true,
  salaryMin: 3_000_000,
  salaryMax: 5_000_000,
  currency: 'VND',
  publishedAt: '2026-11-01T02:00:00.000Z',
  expiresAt: '2026-12-31T16:59:59.000Z',
  closedAt: null,
  skills: [
    { id: 's1', slug: 'nodejs', name: 'Node.js', isRequired: true },
    { id: 's2', slug: 'postgresql', name: 'PostgreSQL', isRequired: false },
  ],
  description: 'Làm API',
  descriptionHtml: '<p>Làm API</p>',
  requirements: 'Biết TypeScript',
  requirementsHtml: '<p>Biết TypeScript</p>',
  benefits: null,
  benefitsHtml: null,
  address: '1 Đại Cồ Việt',
  quantity: 2,
  isAcceptingApplications: true,
  seo: { indexable: true },
};

const build = (overrides: Partial<PublicJobDetail> = {}) => {
  const jsonLd = buildJobPostingJsonLd({ ...job, ...overrides });
  if (!jsonLd) throw new Error('Tin indexable phải có JSON-LD');
  return jsonLd;
};

describe('buildJobPostingJsonLd', () => {
  it('tin tại văn phòng, có lương: đủ các trường Google cần', () => {
    expect(build()).toEqual({
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'Thực tập Backend',
      description: '<p>Làm API</p>\n<h3>Yêu cầu</h3><p>Biết TypeScript</p>',
      datePosted: '2026-11-01T02:00:00.000Z',
      validThrough: '2026-12-31T16:59:59.000Z',
      employmentType: 'INTERN',
      identifier: { '@type': 'PropertyValue', name: 'Công ty A', value: 'a1b2c3' },
      hiringOrganization: {
        '@type': 'Organization',
        name: 'Công ty A',
        sameAs: 'https://congtya.vn',
        logo: 'https://res.cloudinary.com/demo/logo.png',
      },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '1 Đại Cồ Việt',
          addressRegion: 'Hà Nội',
          addressCountry: 'VN',
        },
      },
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'VND',
        value: {
          '@type': 'QuantitativeValue',
          minValue: 3_000_000,
          maxValue: 5_000_000,
          unitText: 'MONTH',
        },
      },
      directApply: true,
      inLanguage: 'vi',
      skills: 'Node.js, PostgreSQL',
    });
  });

  it('làm từ xa: TELECOMMUTE, ứng viên ở Việt Nam, không có jobLocation', () => {
    const jsonLd = build({ workMode: 'REMOTE' });
    expect(jsonLd.jobLocationType).toBe('TELECOMMUTE');
    expect(jsonLd.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'VN' });
    expect(jsonLd).not.toHaveProperty('jobLocation');
  });

  it('hybrid vẫn có địa điểm; thiếu địa chỉ, tỉnh/thành thì chỉ còn quốc gia', () => {
    const jsonLd = build({ workMode: 'HYBRID', address: null, location: null });
    expect(jsonLd.jobLocation?.address).toEqual({
      '@type': 'PostalAddress',
      addressCountry: 'VN',
    });
    expect(jsonLd).not.toHaveProperty('jobLocationType');
  });

  it('không lương, hoặc có lương mà không ghi mức: không có baseSalary', () => {
    expect(build({ isPaid: false })).not.toHaveProperty('baseSalary');
    expect(build({ salaryMin: null, salaryMax: null })).not.toHaveProperty('baseSalary');
  });

  it('chỉ ghi một mức lương thì chỉ có mức đó', () => {
    expect(build({ salaryMin: null }).baseSalary?.value).toEqual({
      '@type': 'QuantitativeValue',
      maxValue: 5_000_000,
      unitText: 'MONTH',
    });
  });

  it('mô tả ghép đủ ba phần, tiêu đề mục theo ngôn ngữ của trang', () => {
    const jsonLd = build({ locale: 'en', benefitsHtml: '<p>Laptop</p>' });
    expect(jsonLd.description).toBe(
      '<p>Làm API</p>\n<h3>Requirements</h3><p>Biết TypeScript</p>\n<h3>Benefits</h3><p>Laptop</p>',
    );
    expect(jsonLd.inLanguage).toBe('en');
  });

  it('không có mô tả, yêu cầu, quyền lợi thì dùng tiêu đề tin', () => {
    expect(build({ descriptionHtml: null, requirementsHtml: null }).description).toBe(
      'Thực tập Backend',
    );
  });

  it('công ty không có website, logo; tin không có kỹ năng: không sinh trường rỗng', () => {
    const jsonLd = build({
      company: { ...job.company, website: null, logoUrl: null },
      skills: [],
    });
    expect(jsonLd.hiringOrganization).toEqual({ '@type': 'Organization', name: 'Công ty A' });
    expect(jsonLd).not.toHaveProperty('skills');
  });

  it('tin không được index (đã đóng, hết hạn) thì không có JSON-LD', () => {
    expect(buildJobPostingJsonLd({ ...job, seo: { indexable: false } })).toBeNull();
  });
});

describe('serializeJsonLd', () => {
  it('escape < để nội dung chứa </script> không đóng thẻ script sớm', () => {
    const text = serializeJsonLd({ title: '</script><script>alert(1)</script>' });
    expect(text).not.toContain('<');
    expect(JSON.parse(text)).toEqual({ title: '</script><script>alert(1)</script>' });
  });
});
