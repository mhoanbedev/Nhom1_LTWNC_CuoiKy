import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ErrorCode } from '@ltwnc/shared';
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from 'cloudinary';
import { AppException } from '../../common/exceptions/app.exception';
import { cloudinaryConfig } from '../../config/cloudinary.config';

export interface UploadedImage {
  /** URL https công khai, lưu vào DB (logoUrl, avatarUrl). */
  url: string;
  /** Dùng để xóa ảnh cũ khi đổi ảnh. */
  publicId: string;
}

export interface UploadedPrivateFile {
  publicId: string;
  bytes: number;
}

export interface SignedDownload {
  url: string;
  expiresAt: Date;
}

/**
 * Lớp tích hợp duy nhất với Cloudinary (mục 5.5 của đặc tả). Module khác không gọi SDK trực tiếp;
 * test thì mock service này.
 * - Ảnh (logo, avatar): công khai (`type: upload`), resize ngay khi upload.
 * - File riêng tư (CV): `resource_type: raw`, `type: authenticated`, không có URL công khai;
 *   chỉ tải được qua link ký có hạn.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(@Inject(cloudinaryConfig.KEY) config: ConfigType<typeof cloudinaryConfig>) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  /** Upload ảnh công khai, thu nhỏ để cạnh dài nhất không quá `maxSize` px (không phóng to). */
  async uploadImage(
    buffer: Buffer,
    options: { folder: string; maxSize: number },
  ): Promise<UploadedImage> {
    const result = await this.upload(buffer, {
      folder: options.folder,
      resource_type: 'image',
      type: 'upload',
      transformation: [{ width: options.maxSize, height: options.maxSize, crop: 'limit' }],
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  /**
   * Xóa ảnh công khai. Ảnh không còn thì bỏ qua. Lỗi chỉ ghi log, không ném: ảnh cũ sót lại
   * trên Cloudinary không đáng làm hỏng request đổi ảnh đã thành công.
   */
  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    } catch (error) {
      this.logger.warn(`Không xóa được ảnh ${publicId}: ${describe(error)}`);
    }
  }

  /** Upload file riêng tư. `fileName` gồm cả đuôi (vd `<uuid>.pdf`) để file tải về có đúng đuôi. */
  async uploadPrivateFile(
    buffer: Buffer,
    options: { folder: string; fileName: string },
  ): Promise<UploadedPrivateFile> {
    const result = await this.upload(buffer, {
      folder: options.folder,
      public_id: options.fileName,
      resource_type: 'raw',
      type: 'authenticated',
      overwrite: false,
    });
    return { publicId: result.public_id, bytes: result.bytes };
  }

  /** Link tải file riêng tư, hết hạn sau `ttlSeconds`. Ký bằng API secret, không gọi mạng. */
  privateDownloadUrl(publicId: string, ttlSeconds: number): SignedDownload {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const url = cloudinary.utils.private_download_url(publicId, '', {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: Math.floor(expiresAt.getTime() / 1000),
    });
    return { url, expiresAt };
  }

  private upload(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (result && !error) return resolve(result);
        this.logger.error(`Upload Cloudinary lỗi (${options.folder ?? ''}): ${describe(error)}`);
        reject(new AppException(ErrorCode.SERVICE_UNAVAILABLE));
      });
      stream.end(buffer);
    });
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return String(error);
}
