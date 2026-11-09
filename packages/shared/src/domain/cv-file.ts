/** CV: chỉ PDF, tối đa 5 MB, mỗi ứng viên tối đa 5 CV chưa xóa (mục 5.5 của đặc tả). */
export const CV_MAX_MB = 5;
export const CV_MAX_BYTES = CV_MAX_MB * 1024 * 1024;
export const CV_MAX_COUNT = 5;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** 5 byte đầu là `%PDF-`. Không tin đuôi file hay MIME type client gửi. */
export function isPdfBuffer(bytes: Uint8Array): boolean {
  return bytes.length >= PDF_MAGIC.length && PDF_MAGIC.every((byte, i) => bytes[i] === byte);
}
