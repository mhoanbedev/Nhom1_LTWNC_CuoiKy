import { ErrorCode } from '@ltwnc/shared';
import { errorMessage } from './error-messages';

describe('errorMessage', () => {
  it('trả câu báo theo mã lỗi', () => {
    expect(errorMessage(ErrorCode.NOT_FOUND)).toBe('Không tìm thấy dữ liệu');
  });

  it('điền tham số vào {tên}', () => {
    expect(errorMessage(ErrorCode.FILE_TOO_LARGE, { maxMb: 5 })).toBe('File vượt quá 5 MB');
  });

  it('giữ nguyên {tên} khi thiếu tham số', () => {
    expect(errorMessage(ErrorCode.FILE_TOO_LARGE, {})).toBe('File vượt quá {maxMb} MB');
  });
});
