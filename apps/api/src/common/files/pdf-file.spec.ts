import { ErrorCode } from '@ltwnc/shared';
import { AppException } from '../exceptions/app.exception';
import { assertPdfFile, decodeOriginalName, type UploadedPdfLike } from './pdf-file';

const PDF = Buffer.from('%PDF-1.7\n%...');
const pdf = (overrides: Partial<UploadedPdfLike> = {}): UploadedPdfLike => ({
  buffer: PDF,
  size: PDF.length,
  originalname: 'cv.pdf',
  mimetype: 'application/pdf',
  ...overrides,
});

function codeOf(fn: () => void): { code?: ErrorCode; params?: unknown } {
  try {
    fn();
    return {};
  } catch (error) {
    if (error instanceof AppException) return { code: error.code, params: error.params };
    throw error;
  }
}

describe('assertPdfFile', () => {
  it('nhận PDF hợp lệ (đuôi viết hoa cũng được)', () => {
    expect(codeOf(() => assertPdfFile(pdf({ originalname: 'CV.PDF' })))).toEqual({});
  });

  it.each([
    ['thiếu file', undefined],
    ['MIME sai', pdf({ mimetype: 'image/png' })],
    ['đuôi sai', pdf({ originalname: 'cv.docx' })],
    ['nội dung không phải PDF dù đuôi .pdf', pdf({ buffer: Buffer.from('MZ...exe') })],
  ])('%s: FILE_INVALID_TYPE', (_label, file) => {
    expect(codeOf(() => assertPdfFile(file))).toEqual({
      code: ErrorCode.FILE_INVALID_TYPE,
      params: { allowed: 'PDF' },
    });
  });

  it('quá 5 MB: FILE_TOO_LARGE kèm maxMb', () => {
    expect(codeOf(() => assertPdfFile(pdf({ size: 5 * 1024 * 1024 + 1 })))).toEqual({
      code: ErrorCode.FILE_TOO_LARGE,
      params: { maxMb: 5 },
    });
  });
});

describe('decodeOriginalName', () => {
  it('sửa tên tiếng Việt multer đọc sai mã hóa', () => {
    const asMulterReads = Buffer.from('CV Nguyễn An.pdf', 'utf8').toString('latin1');
    expect(decodeOriginalName(asMulterReads)).toBe('CV Nguyễn An.pdf');
  });

  it('tên ASCII giữ nguyên, rỗng thì đặt cv.pdf', () => {
    expect(decodeOriginalName('my-cv.pdf')).toBe('my-cv.pdf');
    expect(decodeOriginalName('   ')).toBe('cv.pdf');
  });
});
