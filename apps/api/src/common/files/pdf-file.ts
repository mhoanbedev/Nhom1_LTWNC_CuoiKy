import { CV_MAX_BYTES, CV_MAX_MB, ErrorCode, isPdfBuffer } from '@ltwnc/shared';
import { AppException } from '../exceptions/app.exception';
import type { UploadedFileLike } from './image-file';

export interface UploadedPdfLike extends UploadedFileLike {
  originalname: string;
  mimetype: string;
}

const PDF_LABEL = 'PDF';

/**
 * Kiểm CV upload đủ 3 thứ (mục 5.5 của đặc tả): MIME type, đuôi `.pdf`, và 5 byte đầu `%PDF-`.
 * Thiếu, quá 5 MB hay sai loại thì 400.
 */
export function assertPdfFile(file: UploadedPdfLike | undefined): asserts file is UploadedPdfLike {
  if (!file || file.buffer.length === 0) {
    throw new AppException(ErrorCode.FILE_INVALID_TYPE, { allowed: PDF_LABEL });
  }
  if (file.size > CV_MAX_BYTES) {
    throw new AppException(ErrorCode.FILE_TOO_LARGE, { maxMb: CV_MAX_MB });
  }
  const validType =
    file.mimetype === 'application/pdf' &&
    file.originalname.toLowerCase().endsWith('.pdf') &&
    isPdfBuffer(file.buffer);
  if (!validType) throw new AppException(ErrorCode.FILE_INVALID_TYPE, { allowed: PDF_LABEL });
}

/**
 * Multer đọc tên file trong multipart theo latin1, nên "CV Nguyễn An.pdf" thành chuỗi lỗi dấu.
 * Đổi lại về UTF-8; tên vốn ASCII thì giữ nguyên. Cắt còn 255 ký tự cho vừa cột.
 */
export function decodeOriginalName(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  const fixed = decoded.includes('�') ? name : decoded;
  return fixed.trim().slice(0, 255) || 'cv.pdf';
}
