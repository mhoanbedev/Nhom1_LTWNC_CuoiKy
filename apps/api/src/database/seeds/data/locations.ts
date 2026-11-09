/**
 * 34 đơn vị hành chính cấp tỉnh từ 01/07/2025 (Nghị quyết 202/2025/QH15): 6 thành phố trực thuộc
 * trung ương và 28 tỉnh. `code` là khoá ổn định không dấu do dự án tự đặt, không phải mã hành chính.
 */
export interface LocationSeed {
  code: string;
  nameVi: string;
  nameEn: string;
}

export const LOCATIONS: readonly LocationSeed[] = [
  // 6 thành phố trực thuộc trung ương
  { code: 'ha-noi', nameVi: 'Hà Nội', nameEn: 'Hanoi' },
  { code: 'ho-chi-minh', nameVi: 'TP. Hồ Chí Minh', nameEn: 'Ho Chi Minh City' },
  { code: 'hai-phong', nameVi: 'Hải Phòng', nameEn: 'Hai Phong' },
  { code: 'da-nang', nameVi: 'Đà Nẵng', nameEn: 'Da Nang' },
  { code: 'can-tho', nameVi: 'Cần Thơ', nameEn: 'Can Tho' },
  { code: 'hue', nameVi: 'Huế', nameEn: 'Hue' },
  // 28 tỉnh
  { code: 'lai-chau', nameVi: 'Lai Châu', nameEn: 'Lai Chau' },
  { code: 'dien-bien', nameVi: 'Điện Biên', nameEn: 'Dien Bien' },
  { code: 'son-la', nameVi: 'Sơn La', nameEn: 'Son La' },
  { code: 'lang-son', nameVi: 'Lạng Sơn', nameEn: 'Lang Son' },
  { code: 'quang-ninh', nameVi: 'Quảng Ninh', nameEn: 'Quang Ninh' },
  { code: 'thanh-hoa', nameVi: 'Thanh Hóa', nameEn: 'Thanh Hoa' },
  { code: 'nghe-an', nameVi: 'Nghệ An', nameEn: 'Nghe An' },
  { code: 'ha-tinh', nameVi: 'Hà Tĩnh', nameEn: 'Ha Tinh' },
  { code: 'cao-bang', nameVi: 'Cao Bằng', nameEn: 'Cao Bang' },
  { code: 'tuyen-quang', nameVi: 'Tuyên Quang', nameEn: 'Tuyen Quang' },
  { code: 'lao-cai', nameVi: 'Lào Cai', nameEn: 'Lao Cai' },
  { code: 'thai-nguyen', nameVi: 'Thái Nguyên', nameEn: 'Thai Nguyen' },
  { code: 'phu-tho', nameVi: 'Phú Thọ', nameEn: 'Phu Tho' },
  { code: 'bac-ninh', nameVi: 'Bắc Ninh', nameEn: 'Bac Ninh' },
  { code: 'hung-yen', nameVi: 'Hưng Yên', nameEn: 'Hung Yen' },
  { code: 'ninh-binh', nameVi: 'Ninh Bình', nameEn: 'Ninh Binh' },
  { code: 'quang-tri', nameVi: 'Quảng Trị', nameEn: 'Quang Tri' },
  { code: 'quang-ngai', nameVi: 'Quảng Ngãi', nameEn: 'Quang Ngai' },
  { code: 'gia-lai', nameVi: 'Gia Lai', nameEn: 'Gia Lai' },
  { code: 'khanh-hoa', nameVi: 'Khánh Hòa', nameEn: 'Khanh Hoa' },
  { code: 'lam-dong', nameVi: 'Lâm Đồng', nameEn: 'Lam Dong' },
  { code: 'dak-lak', nameVi: 'Đắk Lắk', nameEn: 'Dak Lak' },
  { code: 'dong-nai', nameVi: 'Đồng Nai', nameEn: 'Dong Nai' },
  { code: 'tay-ninh', nameVi: 'Tây Ninh', nameEn: 'Tay Ninh' },
  { code: 'vinh-long', nameVi: 'Vĩnh Long', nameEn: 'Vinh Long' },
  { code: 'dong-thap', nameVi: 'Đồng Tháp', nameEn: 'Dong Thap' },
  { code: 'ca-mau', nameVi: 'Cà Mau', nameEn: 'Ca Mau' },
  { code: 'an-giang', nameVi: 'An Giang', nameEn: 'An Giang' },
];
