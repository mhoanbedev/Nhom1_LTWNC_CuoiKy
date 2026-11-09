import { ErrorCode } from '@ltwnc/shared';
import { AppException } from '../exceptions/app.exception';
import { assertImageFile, detectImageType, IMAGE_MAX_BYTES } from './image-file';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
]);
const PDF = Buffer.from('%PDF-1.4\n');
const GIF = Buffer.from('GIF89a');

function errorCode(fn: () => void): ErrorCode | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppException) return error.code;
    throw error;
  }
  return undefined;
}

describe('detectImageType', () => {
  it.each([
    ['JPEG', JPEG, 'image/jpeg'],
    ['PNG', PNG, 'image/png'],
    ['WebP', WEBP, 'image/webp'],
  ])('nhận %s theo magic bytes', (_label, buffer, expected) => {
    expect(detectImageType(buffer)).toBe(expected);
  });

  it.each([
    ['PDF', PDF],
    ['GIF', GIF],
    ['RIFF không phải WebP (vd WAV)', Buffer.concat([Buffer.from('RIFF0000WAVE')])],
    ['buffer rỗng', Buffer.alloc(0)],
  ])('từ chối %s', (_label, buffer) => {
    expect(detectImageType(buffer)).toBeNull();
  });
});

describe('assertImageFile', () => {
  it('nhận ảnh hợp lệ', () => {
    expect(errorCode(() => assertImageFile({ buffer: PNG, size: PNG.length }))).toBeUndefined();
  });

  it('thiếu file trả FILE_INVALID_TYPE', () => {
    expect(errorCode(() => assertImageFile(undefined))).toBe(ErrorCode.FILE_INVALID_TYPE);
  });

  it('quá 2 MB trả FILE_TOO_LARGE kèm maxMb', () => {
    try {
      assertImageFile({ buffer: PNG, size: IMAGE_MAX_BYTES + 1 });
      throw new Error('phải ném lỗi');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect(error).toMatchObject({ code: ErrorCode.FILE_TOO_LARGE, params: { maxMb: 2 } });
    }
  });

  it('nội dung không phải ảnh (dù đổi đuôi) trả FILE_INVALID_TYPE', () => {
    expect(errorCode(() => assertImageFile({ buffer: PDF, size: PDF.length }))).toBe(
      ErrorCode.FILE_INVALID_TYPE,
    );
  });
});
