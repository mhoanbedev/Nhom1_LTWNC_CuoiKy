/** Kỹ năng hay gặp ở tin thực tập. Tên công nghệ giữ nguyên ở cả hai ngôn ngữ. */
export interface SkillSeed {
  slug: string;
  nameVi: string;
  nameEn: string;
}

/** Tên riêng (công nghệ, công cụ): hai ngôn ngữ giống nhau. */
const same = (slug: string, name: string): SkillSeed => ({ slug, nameVi: name, nameEn: name });

export const SKILLS: readonly SkillSeed[] = [
  // Ngôn ngữ lập trình
  same('javascript', 'JavaScript'),
  same('typescript', 'TypeScript'),
  same('python', 'Python'),
  same('java', 'Java'),
  same('csharp', 'C#'),
  same('cpp', 'C++'),
  same('go', 'Go'),
  same('php', 'PHP'),
  same('kotlin', 'Kotlin'),
  same('swift', 'Swift'),
  same('dart', 'Dart'),
  same('sql', 'SQL'),
  // Frontend
  same('html', 'HTML'),
  same('css', 'CSS'),
  same('tailwind-css', 'Tailwind CSS'),
  same('react', 'React'),
  same('nextjs', 'Next.js'),
  same('vuejs', 'Vue.js'),
  same('angular', 'Angular'),
  // Backend
  same('nodejs', 'Node.js'),
  same('nestjs', 'NestJS'),
  same('expressjs', 'Express'),
  same('spring-boot', 'Spring Boot'),
  same('aspnet-core', 'ASP.NET Core'),
  same('django', 'Django'),
  same('fastapi', 'FastAPI'),
  same('laravel', 'Laravel'),
  same('rest-api', 'REST API'),
  same('graphql', 'GraphQL'),
  // Mobile
  same('flutter', 'Flutter'),
  same('react-native', 'React Native'),
  same('android', 'Android'),
  same('ios', 'iOS'),
  // Database
  same('postgresql', 'PostgreSQL'),
  same('mysql', 'MySQL'),
  same('sql-server', 'SQL Server'),
  same('mongodb', 'MongoDB'),
  same('redis', 'Redis'),
  // DevOps, công cụ
  same('git', 'Git'),
  same('docker', 'Docker'),
  same('kubernetes', 'Kubernetes'),
  same('linux', 'Linux'),
  same('aws', 'AWS'),
  same('ci-cd', 'CI/CD'),
  // Kiểm thử
  { slug: 'manual-testing', nameVi: 'Kiểm thử thủ công', nameEn: 'Manual Testing' },
  { slug: 'automation-testing', nameVi: 'Kiểm thử tự động', nameEn: 'Automation Testing' },
  { slug: 'unit-testing', nameVi: 'Viết unit test', nameEn: 'Unit Testing' },
  // Dữ liệu, AI
  { slug: 'data-analysis', nameVi: 'Phân tích dữ liệu', nameEn: 'Data Analysis' },
  { slug: 'machine-learning', nameVi: 'Học máy', nameEn: 'Machine Learning' },
  same('power-bi', 'Power BI'),
  same('excel', 'Excel'),
  // Thiết kế
  same('figma', 'Figma'),
  { slug: 'ui-ux-design', nameVi: 'Thiết kế UI/UX', nameEn: 'UI/UX Design' },
  same('photoshop', 'Photoshop'),
  // Marketing, nội dung
  same('digital-marketing', 'Digital Marketing'),
  same('seo', 'SEO'),
  { slug: 'content-writing', nameVi: 'Viết nội dung', nameEn: 'Content Writing' },
  // Ngoại ngữ, kỹ năng mềm
  { slug: 'english', nameVi: 'Tiếng Anh', nameEn: 'English' },
  { slug: 'japanese', nameVi: 'Tiếng Nhật', nameEn: 'Japanese' },
  { slug: 'communication', nameVi: 'Giao tiếp', nameEn: 'Communication' },
  { slug: 'teamwork', nameVi: 'Làm việc nhóm', nameEn: 'Teamwork' },
  { slug: 'agile-scrum', nameVi: 'Agile/Scrum', nameEn: 'Agile/Scrum' },
];
