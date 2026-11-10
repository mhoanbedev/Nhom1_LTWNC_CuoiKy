import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ErrorCode,
  type Locale,
  type NotificationItem,
  type NotificationPayload,
  type NotificationsQuery,
  type Paginated,
  type ReadAllResult,
  type UnreadCount,
} from '@ltwnc/shared';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { paginate, toSkipTake } from '../../common/utils/paginate';
import { Notification } from './entities/notification.entity';
import { NotificationStreamService } from './notification-stream.service';
import { renderNotification } from './notification-renderer';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    private readonly i18n: I18nService,
    private readonly stream: NotificationStreamService,
  ) {}

  /**
   * Tạo thông báo bằng `manager` của transaction đang chạy: hành động lỗi (rollback) thì không để
   * lại thông báo "ma" (mục 5.8 của đặc tả). Số chưa đọc được đẩy qua SSE sau khi transaction commit.
   */
  async create(
    manager: EntityManager,
    userId: string,
    payload: NotificationPayload,
  ): Promise<void> {
    await manager.getRepository(Notification).insert({ userId, ...payload, readAt: null });
    this.stream.publishAfterCommit(manager.queryRunner, userId);
  }

  /** Mới nhất lên trước; `?unread=true` chỉ lấy chưa đọc. */
  async list(
    userId: string,
    query: NotificationsQuery,
    locale: Locale,
  ): Promise<Paginated<NotificationItem>> {
    const { skip, take } = toSkipTake(query);
    const [rows, total] = await this.notifications.findAndCount({
      where: { userId, ...(query.unread ? { readAt: IsNull() } : {}) },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip,
      take,
    });
    return paginate(
      rows.map((row) => this.toItem(row, locale)),
      total,
      query,
    );
  }

  async unreadCount(userId: string): Promise<UnreadCount> {
    return { count: await this.notifications.countBy({ userId, readAt: IsNull() }) };
  }

  /** Đánh dấu đã đọc; gọi lại không đổi gì. Thông báo của người khác trả 404. */
  async markRead(userId: string, id: string, locale: Locale): Promise<NotificationItem> {
    const row = await this.notifications.findOneBy({ id, userId });
    if (!row) throw new AppException(ErrorCode.NOT_FOUND);
    if (!row.readAt) {
      row.readAt = new Date();
      await this.notifications.update(row.id, { readAt: row.readAt });
      this.stream.publish(userId);
    }
    return this.toItem(row, locale);
  }

  async markAllRead(userId: string): Promise<ReadAllResult> {
    const result = await this.notifications.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    const updated = result.affected ?? 0;
    if (updated > 0) this.stream.publish(userId);
    return { updated };
  }

  private toItem(row: Notification, locale: Locale): NotificationItem {
    const payload = { type: row.type, data: row.data } as NotificationPayload;
    const { title, body } = renderNotification(payload, locale, (key, args) =>
      this.i18n.t(`notifications.${key}`, { lang: locale, args }),
    );
    return {
      ...payload,
      id: row.id,
      title,
      body,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
