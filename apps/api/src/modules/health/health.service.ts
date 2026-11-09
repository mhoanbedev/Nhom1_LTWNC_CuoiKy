import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ErrorCode } from '@ltwnc/shared';
import { DataSource } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import type { HealthResponse } from './dto/health-response.dto';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Kiểm tra API còn kết nối được database. Render gọi endpoint này làm health check,
   * nên database lỗi thì phải trả 503 chứ không được trả 200.
   * Chỉ là lệnh ping hạ tầng (`SELECT 1`), không phải truy vấn nghiệp vụ nên không cần repository.
   */
  async check(): Promise<HealthResponse> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      this.logger.error(
        'Không kết nối được database',
        error instanceof Error ? error.stack : error,
      );
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
    }

    return {
      status: 'ok',
      database: 'up',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
