import { ErrorCode } from '@ltwnc/shared';
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from 'cloudinary';
import { AppException } from '../../common/exceptions/app.exception';
import { CloudinaryService } from './cloudinary.service';

type UploadCallback = (error?: unknown, result?: Partial<UploadApiResponse>) => void;

/** Giả lập upload_stream: gọi callback với kết quả cho trước khi stream.end() được gọi. */
function mockUploadStream(outcome: { error?: unknown; result?: Partial<UploadApiResponse> }) {
  const end = jest.fn();
  const spy = jest.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation(((
    options: UploadApiOptions,
    callback: UploadCallback,
  ) => {
    end.mockImplementation(() => callback(outcome.error, outcome.result));
    return { end } as never;
  }) as never);
  return { spy, end };
}

describe('CloudinaryService', () => {
  let service: CloudinaryService;

  beforeEach(() => {
    jest.restoreAllMocks();
    service = new CloudinaryService({
      cloudName: 'test-cloud',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
    });
  });

  it('uploadImage: ảnh công khai, resize giới hạn cạnh, trả secure_url và public_id', async () => {
    const { spy, end } = mockUploadStream({
      result: { secure_url: 'https://res.cloudinary.com/x/logo.png', public_id: 'logos/abc' },
    });
    const buffer = Buffer.from('anh');
    await expect(service.uploadImage(buffer, { folder: 'logos', maxSize: 512 })).resolves.toEqual({
      url: 'https://res.cloudinary.com/x/logo.png',
      publicId: 'logos/abc',
    });
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      folder: 'logos',
      resource_type: 'image',
      type: 'upload',
      transformation: [{ width: 512, height: 512, crop: 'limit' }],
    });
    expect(end).toHaveBeenCalledWith(buffer);
  });

  it('uploadPrivateFile: raw + authenticated, giữ tên file có đuôi', async () => {
    const { spy } = mockUploadStream({ result: { public_id: 'cvs/u1/abc.pdf', bytes: 1234 } });
    await expect(
      service.uploadPrivateFile(Buffer.from('%PDF'), { folder: 'cvs/u1', fileName: 'abc.pdf' }),
    ).resolves.toEqual({ publicId: 'cvs/u1/abc.pdf', bytes: 1234 });
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      public_id: 'abc.pdf',
      resource_type: 'raw',
      type: 'authenticated',
      overwrite: false,
    });
  });

  it('Cloudinary lỗi thì trả SERVICE_UNAVAILABLE, không lộ lỗi gốc', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockUploadStream({ error: { message: 'Invalid API key', http_code: 401 } });
    const error = await service
      .uploadImage(Buffer.from('x'), { folder: 'logos', maxSize: 512 })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });

  it('deleteImage nuốt lỗi (chỉ ghi log)', async () => {
    jest.spyOn(cloudinary.uploader, 'destroy').mockRejectedValue(new Error('mạng lỗi'));
    await expect(service.deleteImage('logos/abc')).resolves.toBeUndefined();
  });

  it('privateDownloadUrl: link ký có hạn cho file raw authenticated', () => {
    const now = Date.now();
    const { url, expiresAt } = service.privateDownloadUrl('cvs/u1/abc.pdf', 60);
    expect(url).toContain('https://api.cloudinary.com/v1_1/test-cloud/raw/download');
    expect(url).toContain('type=authenticated');
    expect(url).toContain('signature=');
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(now + 59_000);
    const expiresParam = new URL(url).searchParams.get('expires_at');
    expect(Number(expiresParam)).toBe(Math.floor(expiresAt.getTime() / 1000));
  });
});
