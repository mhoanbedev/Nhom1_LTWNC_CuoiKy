import { APPLICATION_TRANSITIONS, ApplicationStatus, canTransition } from '@ltwnc/shared';
import { SKILLS } from '../data/skills';
import { applicationPath } from './application-path';
import { buildPdf, seedCvs } from './demo-cv';
import { COMPANIES, ROLES } from './demo-content';
import { INDUSTRIES } from '../data/industries';
import { LOCATIONS } from '../data/locations';

describe('applicationPath', () => {
  const statuses = Object.keys(APPLICATION_TRANSITIONS) as ApplicationStatus[];

  it.each(statuses)('chuỗi tới %s luôn hợp lệ theo bảng 5.4, bắt đầu từ lúc nộp', (final) => {
    for (const stopAt of [0, 1, 2, 5]) {
      const path = applicationPath(final, stopAt);
      expect(path[0]).toEqual({ from: null, to: 'SUBMITTED', actor: 'CANDIDATE' });
      expect(path.at(-1)?.to).toBe(final);
      for (const step of path.slice(1)) {
        expect(canTransition(step.from as ApplicationStatus, step.to, step.actor)).toBe(true);
      }
    }
  });

  it('trượt ở vòng phỏng vấn: đi qua REVIEWING, INTERVIEW rồi FAILED', () => {
    expect(applicationPath(ApplicationStatus.FAILED, 2).map((step) => step.to)).toEqual([
      'SUBMITTED',
      'REVIEWING',
      'INTERVIEW',
      'FAILED',
    ]);
  });
});

describe('dữ liệu mẫu', () => {
  const skillSlugs = new Set(SKILLS.map((skill) => skill.slug));

  it('mọi kỹ năng của vị trí mẫu có trong danh mục', () => {
    for (const role of ROLES) {
      for (const slug of [...role.required, ...role.preferred]) expect(skillSlugs).toContain(slug);
    }
  });

  it('ngành, tỉnh/thành của công ty mẫu có trong danh mục; đủ 12 công ty', () => {
    const industries = new Set(INDUSTRIES.map((item) => item.slug));
    const locations = new Set(LOCATIONS.map((item) => item.code));
    expect(COMPANIES).toHaveLength(12);
    for (const company of COMPANIES) {
      expect(industries).toContain(company.industry);
      expect(locations).toContain(company.location);
    }
  });
});

describe('buildPdf', () => {
  it('ra file PDF hợp lệ về cấu trúc (header, xref trỏ đúng)', () => {
    const pdf = buildPdf(['Hello (world)']).toString('latin1');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe('xref');
    expect(pdf).toContain('(Hello \\(world\\))');
  });

  it('3 CV mẫu có public_id cố định khác nhau', () => {
    const names = seedCvs().map((cv) => cv.fileName);
    expect(new Set(names).size).toBe(3);
  });
});
