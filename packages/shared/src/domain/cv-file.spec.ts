import { isPdfBuffer } from './cv-file';

describe('isPdfBuffer', () => {
  it('nhận file bắt đầu bằng %PDF-', () => {
    expect(isPdfBuffer(new TextEncoder().encode('%PDF-1.7\n...'))).toBe(true);
  });

  it.each([
    ['ảnh PNG', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d])],
    ['chữ thường "%pdf-"', new TextEncoder().encode('%pdf-1.4')],
    ['ngắn hơn 5 byte', new TextEncoder().encode('%PDF')],
    ['rỗng', new Uint8Array()],
  ])('từ chối %s', (_label, bytes) => {
    expect(isPdfBuffer(bytes)).toBe(false);
  });
});
