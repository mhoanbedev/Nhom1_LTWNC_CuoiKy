import { ErrorCode } from '@ltwnc/shared';
import { AppException } from '../exceptions/app.exception';

/** Ảnh logo, avatar: jpg/png/webp, tối đa 2 MB (mục 5.5 của đặc tả). */
export const IMAGE_MAX_MB = 2;
export const IMAGE_MAX_BYTES = IMAGE_MAX_MB * 1024 * 1024;
export const IMAGE_ALLOWED_LABEL = 'JPG, PNG, WebP';

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

const startsWith = (buffer: Buffer, bytes: number[], offset = 0): boolean =>
  buffer.length >= offset + bytes.length && bytes.every((byte, i) => buffer[offset + i] === byte);

/**
 * Nhận diện ảnh theo vài byte đầu (magic bytes), không tin đuôi file hay MIME type client gửi:
 * đổi tên `virus.exe` thành `anh.png` vẫn bị chặn.
 */
export function detectImageType(buffer: Buffer): ImageMimeType | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // WebP: "RIFF" <4 byte kích thước> "WEBP"
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  return null;
}

/** Phần cần dùng của file multer nhận được (memoryStorage giữ nội dung trong `buffer`). */
export interface UploadedFileLike {
  buffer: Buffer;
  size: number;
}

/** Kiểm file ảnh upload. Thiếu, quá cỡ hay sai loại thì ném lỗi 400. */
export function assertImageFile(
  file: UploadedFileLike | undefined,
): asserts file is UploadedFileLike {
  if (!file || file.buffer.length === 0) {
    throw new AppException(ErrorCode.FILE_INVALID_TYPE, { allowed: IMAGE_ALLOWED_LABEL });
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new AppException(ErrorCode.FILE_TOO_LARGE, { maxMb: IMAGE_MAX_MB });
  }
  if (!detectImageType(file.buffer)) {
    throw new AppException(ErrorCode.FILE_INVALID_TYPE, { allowed: IMAGE_ALLOWED_LABEL });
  }
}
