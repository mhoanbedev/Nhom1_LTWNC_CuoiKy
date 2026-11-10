/**
 * Nội dung mẫu cho seed demo: vị trí thực tập song ngữ (kèm kỹ năng theo slug trong danh mục),
 * công ty, trường, chuyên ngành. Chỉ là dữ liệu tĩnh; seed chọn ngẫu nhiên có seed cố định.
 */

export interface RoleTemplate {
  vi: string;
  en: string;
  /** Kỹ năng bắt buộc (slug trong data/skills.ts). */
  required: string[];
  /** Kỹ năng ưu tiên. */
  preferred: string[];
}

export const ROLES: readonly RoleTemplate[] = [
  {
    vi: 'Thực tập sinh Backend Node.js',
    en: 'Backend Intern (Node.js)',
    required: ['javascript', 'nodejs'],
    preferred: ['typescript', 'postgresql', 'git'],
  },
  {
    vi: 'Thực tập sinh Backend NestJS',
    en: 'NestJS Backend Intern',
    required: ['typescript', 'nestjs'],
    preferred: ['postgresql', 'docker', 'rest-api'],
  },
  {
    vi: 'Thực tập sinh Frontend ReactJS',
    en: 'Frontend Intern (ReactJS)',
    required: ['javascript', 'react'],
    preferred: ['typescript', 'html', 'css'],
  },
  {
    vi: 'Thực tập sinh Frontend Next.js',
    en: 'Next.js Frontend Intern',
    required: ['react', 'nextjs'],
    preferred: ['typescript', 'tailwind-css'],
  },
  {
    vi: 'Thực tập sinh Frontend Vue.js',
    en: 'Vue.js Frontend Intern',
    required: ['javascript', 'vuejs'],
    preferred: ['html', 'css', 'git'],
  },
  {
    vi: 'Thực tập sinh Java Spring Boot',
    en: 'Java Spring Boot Intern',
    required: ['java', 'spring-boot'],
    preferred: ['mysql', 'git', 'rest-api'],
  },
  {
    vi: 'Thực tập sinh .NET',
    en: '.NET Developer Intern',
    required: ['csharp', 'aspnet-core'],
    preferred: ['sql-server', 'git'],
  },
  {
    vi: 'Thực tập sinh Python Django',
    en: 'Python Django Intern',
    required: ['python', 'django'],
    preferred: ['postgresql', 'docker'],
  },
  {
    vi: 'Thực tập sinh Python FastAPI',
    en: 'Python FastAPI Intern',
    required: ['python', 'fastapi'],
    preferred: ['postgresql', 'redis'],
  },
  {
    vi: 'Thực tập sinh PHP Laravel',
    en: 'PHP Laravel Intern',
    required: ['php', 'laravel'],
    preferred: ['mysql', 'git'],
  },
  {
    vi: 'Thực tập sinh Mobile Flutter',
    en: 'Flutter Mobile Intern',
    required: ['dart', 'flutter'],
    preferred: ['git', 'rest-api'],
  },
  {
    vi: 'Thực tập sinh React Native',
    en: 'React Native Intern',
    required: ['javascript', 'react-native'],
    preferred: ['typescript', 'git'],
  },
  {
    vi: 'Thực tập sinh Android',
    en: 'Android Developer Intern',
    required: ['kotlin', 'android'],
    preferred: ['git'],
  },
  {
    vi: 'Thực tập sinh iOS',
    en: 'iOS Developer Intern',
    required: ['swift', 'ios'],
    preferred: ['git'],
  },
  {
    vi: 'Thực tập sinh DevOps',
    en: 'DevOps Intern',
    required: ['linux', 'docker'],
    preferred: ['kubernetes', 'ci-cd', 'aws'],
  },
  {
    vi: 'Thực tập sinh Kiểm thử phần mềm',
    en: 'QA/Tester Intern',
    required: ['manual-testing'],
    preferred: ['automation-testing', 'sql', 'english'],
  },
  {
    vi: 'Thực tập sinh Kiểm thử tự động',
    en: 'Automation Test Intern',
    required: ['automation-testing', 'python'],
    preferred: ['unit-testing', 'ci-cd'],
  },
  {
    vi: 'Thực tập sinh Phân tích dữ liệu',
    en: 'Data Analyst Intern',
    required: ['sql', 'excel'],
    preferred: ['power-bi', 'python', 'data-analysis'],
  },
  {
    vi: 'Thực tập sinh AI/Machine Learning',
    en: 'AI/Machine Learning Intern',
    required: ['python', 'machine-learning'],
    preferred: ['data-analysis', 'english'],
  },
  {
    vi: 'Thực tập sinh Thiết kế UI/UX',
    en: 'UI/UX Design Intern',
    required: ['figma', 'ui-ux-design'],
    preferred: ['photoshop', 'english'],
  },
  {
    vi: 'Thực tập sinh Digital Marketing',
    en: 'Digital Marketing Intern',
    required: ['digital-marketing'],
    preferred: ['seo', 'content-writing', 'excel'],
  },
  {
    vi: 'Thực tập sinh Content Writer',
    en: 'Content Writer Intern',
    required: ['content-writing'],
    preferred: ['seo', 'english'],
  },
  {
    vi: 'Thực tập sinh Business Analyst',
    en: 'Business Analyst Intern',
    required: ['communication', 'excel'],
    preferred: ['sql', 'english', 'agile-scrum'],
  },
  {
    vi: 'Thực tập sinh Phát triển Game',
    en: 'Game Developer Intern',
    required: ['csharp'],
    preferred: ['cpp', 'git'],
  },
  {
    vi: 'Thực tập sinh Go Backend',
    en: 'Go Backend Intern',
    required: ['go'],
    preferred: ['postgresql', 'docker', 'redis'],
  },
];

export interface CompanyTemplate {
  vi: string;
  en: string;
  industry: string;
  location: string;
  size: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  website: string;
}

/** 12 công ty; 8 đầu được duyệt, 3 chờ duyệt, cuối cùng bị từ chối (theo bảng seed của đặc tả). */
export const COMPANIES: readonly CompanyTemplate[] = [
  {
    vi: 'Công ty Cổ phần Công nghệ Sao Việt',
    en: 'Sao Viet Technology JSC',
    industry: 'it-software',
    location: 'ha-noi',
    size: '201-500',
    website: 'https://saoviet.demo.vn',
  },
  {
    vi: 'Công ty TNHH Phần mềm Biển Xanh',
    en: 'Blue Sea Software Co., Ltd',
    industry: 'it-software',
    location: 'ho-chi-minh',
    size: '51-200',
    website: 'https://bienxanh.demo.vn',
  },
  {
    vi: 'Công ty Cổ phần Thương mại điện tử Chợ Số',
    en: 'Cho So E-commerce JSC',
    industry: 'ecommerce',
    location: 'ho-chi-minh',
    size: '500+',
    website: 'https://choso.demo.vn',
  },
  {
    vi: 'Công ty Cổ phần Fintech Ví Vàng',
    en: 'Vi Vang Fintech JSC',
    industry: 'fintech',
    location: 'ha-noi',
    size: '51-200',
    website: 'https://vivang.demo.vn',
  },
  {
    vi: 'Công ty TNHH Giáo dục Học Mãi',
    en: 'Hoc Mai Education Co., Ltd',
    industry: 'education',
    location: 'da-nang',
    size: '11-50',
    website: 'https://hocmai.demo.vn',
  },
  {
    vi: 'Công ty Cổ phần Game Rồng Lửa',
    en: 'Fire Dragon Games JSC',
    industry: 'gaming',
    location: 'ho-chi-minh',
    size: '51-200',
    website: 'https://ronglua.demo.vn',
  },
  {
    vi: 'Công ty TNHH Truyền thông Mặt Trời',
    en: 'Sun Media Co., Ltd',
    industry: 'marketing-media',
    location: 'ha-noi',
    size: '11-50',
    website: 'https://mattroi.demo.vn',
  },
  {
    vi: 'Công ty Cổ phần Logistics Nhanh',
    en: 'Nhanh Logistics JSC',
    industry: 'logistics',
    location: 'hai-phong',
    size: '201-500',
    website: 'https://nhanh.demo.vn',
  },
  {
    vi: 'Công ty TNHH Khởi nghiệp Mầm Non',
    en: 'Seedling Startup Co., Ltd',
    industry: 'it-software',
    location: 'can-tho',
    size: '1-10',
    website: 'https://mamnon.demo.vn',
  },
  {
    vi: 'Công ty Cổ phần Y tế Số An Khang',
    en: 'An Khang Digital Health JSC',
    industry: 'healthcare',
    location: 'hue',
    size: '11-50',
    website: 'https://ankhang.demo.vn',
  },
  {
    vi: 'Công ty TNHH Tư vấn Đông Á',
    en: 'Dong A Consulting Co., Ltd',
    industry: 'consulting',
    location: 'da-nang',
    size: '11-50',
    website: 'https://donga.demo.vn',
  },
  {
    vi: 'Công ty TNHH Bất động sản Ảo',
    en: 'Virtual Real Estate Co., Ltd',
    industry: 'real-estate',
    location: 'ha-noi',
    size: '1-10',
    website: 'https://bdsao.demo.vn',
  },
];

export const SCHOOLS: readonly string[] = [
  'Đại học Bách khoa Hà Nội',
  'Đại học Công nghệ – ĐHQG Hà Nội',
  'Học viện Công nghệ Bưu chính Viễn thông',
  'Đại học Bách khoa – ĐHQG TP.HCM',
  'Đại học Khoa học Tự nhiên – ĐHQG TP.HCM',
  'Đại học Công nghệ Thông tin – ĐHQG TP.HCM',
  'Đại học FPT',
  'Đại học Đà Nẵng',
  'Đại học Cần Thơ',
  'Đại học Kinh tế Quốc dân',
];

export const MAJORS: readonly string[] = [
  'Khoa học máy tính',
  'Kỹ thuật phần mềm',
  'Hệ thống thông tin',
  'Công nghệ thông tin',
  'An toàn thông tin',
  'Khoa học dữ liệu',
  'Thiết kế đồ họa',
  'Marketing',
];

export const HEADLINES: readonly string[] = [
  'Sinh viên năm 3 ngành Công nghệ thông tin',
  'Sinh viên năm cuối, định hướng Backend',
  'Sinh viên yêu thích Frontend và UI/UX',
  'Sinh viên năm 4, quan tâm Data và AI',
  'Sinh viên năm 3, muốn thử sức ở mảng Mobile',
  'Sinh viên năm cuối, có kinh nghiệm làm dự án nhóm',
];

export const NOTES: readonly string[] = [
  'CV ổn, kỹ năng khớp yêu cầu.',
  'Đã gọi điện, ứng viên phản hồi nhanh.',
  'Cần hỏi thêm về dự án cá nhân.',
  'Tiếng Anh tốt, ưu tiên phỏng vấn sớm.',
  'Kinh nghiệm còn ít nhưng thái độ tốt.',
];

export const STATUS_NOTES: readonly string[] = [
  'Mời bạn phỏng vấn online lúc 9h sáng thứ Hai tuần sau.',
  'Cảm ơn bạn đã quan tâm, hẹn gặp lại ở đợt tuyển sau.',
  'Chúc mừng bạn, phòng nhân sự sẽ liên hệ về ngày bắt đầu.',
];

/** Mô tả tin (Markdown) theo ngôn ngữ, dùng chung cho mọi vị trí. */
export function jobDescription(locale: 'vi' | 'en', title: string, company: string) {
  if (locale === 'vi') {
    return {
      description: `**${company}** tuyển ${title.toLowerCase()} tham gia phát triển sản phẩm thực tế cùng đội ngũ kỹ sư giàu kinh nghiệm.\n\n- Làm việc theo quy trình Agile/Scrum\n- Được review code và hướng dẫn 1-1`,
      requirements:
        '- Sinh viên năm 3, năm 4 hoặc mới tốt nghiệp\n- Nắm vững kiến thức nền tảng\n- Chủ động, ham học hỏi',
      benefits:
        '- Trợ cấp thực tập hằng tháng\n- Cơ hội trở thành nhân viên chính thức\n- Môi trường trẻ, linh hoạt giờ giấc',
    };
  }
  return {
    description: `**${company}** is looking for a ${title} to build real products with an experienced engineering team.\n\n- Agile/Scrum process\n- Code reviews and 1-1 mentoring`,
    requirements:
      '- 3rd/4th-year student or fresh graduate\n- Solid fundamentals\n- Proactive and eager to learn',
    benefits:
      '- Monthly internship allowance\n- Chance to become a full-time employee\n- Young team, flexible hours',
  };
}
