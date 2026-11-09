import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { REVALIDATE_SECRET_HEADER, type RevalidatePayload } from '@ltwnc/shared';
import { revalidateConfig } from '../../config/revalidate.config';

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 5000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Lớp tích hợp duy nhất gọi webhook revalidate của Next (mục 9 của đặc tả).
 * Service nghiệp vụ gọi `notify` SAU KHI transaction đã commit (dữ liệu Next đọc lại phải là dữ liệu
 * mới). `notify` không chờ: response của người dùng không bị chậm vì Next; lỗi thì thử lại 3 lần
 * rồi chỉ ghi log, vì trang cache vẫn tự hết hạn sau `revalidate` của Next.
 */
@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);
  /** Chờ giữa các lần thử lại; test đặt về 0. */
  protected retryDelaysMs = [500, 1500];

  constructor(
    @Inject(revalidateConfig.KEY) private readonly config: ConfigType<typeof revalidateConfig>,
  ) {}

  notify(tags: string[]): void {
    const unique = [...new Set(tags)];
    if (unique.length === 0) return;
    void this.send(unique);
  }

  /** Gửi và trả về có thành công không. Không bao giờ ném lỗi. */
  async send(tags: string[]): Promise<boolean> {
    const { url, secret } = this.config;
    if (!url || !secret) {
      this.logger.debug(`Bỏ qua revalidate (chưa đặt REVALIDATE_URL): ${tags.join(', ')}`);
      return false;
    }

    const payload: RevalidatePayload = { tags };
    let lastError = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', [REVALIDATE_SECRET_HEADER]: secret },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.ok) return true;
        lastError = `HTTP ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      const delay = this.retryDelaysMs[attempt - 1];
      if (attempt < MAX_ATTEMPTS && delay !== undefined) await sleep(delay);
    }
    this.logger.warn(
      `Revalidate thất bại sau ${MAX_ATTEMPTS} lần (${lastError}): ${tags.join(', ')}`,
    );
    return false;
  }
}
