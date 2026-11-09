export interface IndustrySeed {
  slug: string;
  nameVi: string;
  nameEn: string;
}

export const INDUSTRIES: readonly IndustrySeed[] = [
  { slug: 'it-software', nameVi: 'Công nghệ thông tin - Phần mềm', nameEn: 'IT - Software' },
  { slug: 'telecommunications', nameVi: 'Viễn thông', nameEn: 'Telecommunications' },
  { slug: 'ecommerce', nameVi: 'Thương mại điện tử', nameEn: 'E-commerce' },
  { slug: 'banking-finance', nameVi: 'Ngân hàng - Tài chính', nameEn: 'Banking & Finance' },
  { slug: 'fintech', nameVi: 'Công nghệ tài chính', nameEn: 'Fintech' },
  { slug: 'education', nameVi: 'Giáo dục - Đào tạo', nameEn: 'Education & Training' },
  { slug: 'healthcare', nameVi: 'Y tế - Chăm sóc sức khỏe', nameEn: 'Healthcare' },
  { slug: 'marketing-media', nameVi: 'Marketing - Truyền thông', nameEn: 'Marketing & Media' },
  { slug: 'gaming', nameVi: 'Trò chơi điện tử', nameEn: 'Gaming' },
  { slug: 'consulting', nameVi: 'Tư vấn', nameEn: 'Consulting' },
  { slug: 'manufacturing', nameVi: 'Sản xuất', nameEn: 'Manufacturing' },
  { slug: 'logistics', nameVi: 'Vận tải - Logistics', nameEn: 'Transportation & Logistics' },
  { slug: 'retail', nameVi: 'Bán lẻ', nameEn: 'Retail' },
  { slug: 'real-estate', nameVi: 'Bất động sản', nameEn: 'Real Estate' },
  { slug: 'hospitality-tourism', nameVi: 'Du lịch - Khách sạn', nameEn: 'Hospitality & Tourism' },
  { slug: 'energy', nameVi: 'Năng lượng', nameEn: 'Energy' },
];
