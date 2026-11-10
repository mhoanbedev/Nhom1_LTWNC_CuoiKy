import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  DataSource,
  EntitySubscriberInterface,
  TransactionCommitEvent,
  TransactionRollbackEvent,
} from 'typeorm';
import { NotificationStreamService } from './notification-stream.service';

/**
 * Đẩy SSE cho người nhận thông báo sau khi transaction tạo thông báo đã commit; rollback thì bỏ.
 * Nhờ vậy nơi tạo thông báo (nộp đơn, đổi trạng thái, duyệt công ty, ẩn tin...) không phải tự gọi.
 */
@Injectable()
export class NotificationCommitSubscriber implements EntitySubscriberInterface {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly stream: NotificationStreamService,
  ) {
    dataSource.subscribers.push(this);
  }

  afterTransactionCommit(event: TransactionCommitEvent): void {
    for (const userId of this.stream.takePending(event.queryRunner)) this.stream.publish(userId);
  }

  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.stream.takePending(event.queryRunner);
  }
}
