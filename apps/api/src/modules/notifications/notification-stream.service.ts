import { Injectable, type MessageEvent, type OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  filter,
  from,
  interval,
  map,
  merge,
  NEVER,
  type Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
  timer,
} from 'rxjs';
import { IsNull, Repository, type QueryRunner } from 'typeorm';
import { Notification } from './entities/notification.entity';

/** Gửi một sự kiện `ping` định kỳ để proxy (Render, Vercel) không cắt kết nối đang rảnh. */
export const HEARTBEAT_MS = 25_000;

/** Khóa trong `queryRunner.data`: người nhận có thông báo mới trong transaction đang chạy. */
const PENDING_KEY = 'pendingNotificationUserIds';

/** `queryRunner.data` là chỗ TypeORM để dành cho dữ liệu riêng của một transaction. */
const pendingOf = (queryRunner: QueryRunner): Record<string, Set<string> | undefined> =>
  queryRunner.data;

/**
 * Đẩy số thông báo chưa đọc theo thời gian thực qua SSE (mục 5.8 của đặc tả). Bộ phát nằm trong bộ
 * nhớ của process: đủ cho 1 instance; chạy nhiều instance thì phải chuyển sang Redis pub/sub.
 */
@Injectable()
export class NotificationStreamService implements OnModuleDestroy {
  private readonly changed = new Subject<string>();
  private readonly closed = new Subject<string>();
  private readonly shutdown = new Subject<void>();

  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {}

  /** Số chưa đọc của `userId` vừa đổi: mọi stream đang mở của người đó nhận số mới. */
  publish(userId: string): void {
    this.changed.next(userId);
  }

  /**
   * Báo `userId` có thông báo mới. Đang trong transaction thì chỉ ghi tạm, đẩy sau khi commit
   * (NotificationCommitSubscriber), để frontend không đọc được số trước commit và rollback thì không
   * có sự kiện "ma". Ngoài transaction thì đẩy ngay.
   */
  publishAfterCommit(queryRunner: QueryRunner | undefined, userId: string): void {
    if (!queryRunner?.isTransactionActive) {
      this.publish(userId);
      return;
    }
    (pendingOf(queryRunner)[PENDING_KEY] ??= new Set()).add(userId);
  }

  /** Lấy và xóa danh sách người nhận đang chờ của một transaction (commit thì đẩy, rollback thì bỏ). */
  takePending(queryRunner: QueryRunner | undefined): string[] {
    if (!queryRunner) return [];
    const data = pendingOf(queryRunner);
    const pending = data[PENDING_KEY];
    delete data[PENDING_KEY];
    return pending ? [...pending] : [];
  }

  /** Đóng mọi stream của `userId` (vd khi admin khóa tài khoản). */
  close(userId: string): void {
    this.closed.next(userId);
  }

  /**
   * Stream của một người: gửi số chưa đọc ngay khi kết nối và mỗi khi số đổi, `ping` mỗi 25 giây.
   * Tự đóng khi access token hết hạn (`expiresAt`, ms), khi bị khóa, hoặc khi app tắt.
   */
  stream(userId: string, expiresAt?: number): Observable<MessageEvent> {
    const counts = merge(of(userId), this.changed.pipe(filter((id) => id === userId))).pipe(
      // Lần đổi mới hơn thì bỏ kết quả đếm cũ đang chờ: luôn gửi số mới nhất.
      switchMap(() => from(this.notifications.countBy({ userId, readAt: IsNull() }))),
      map((count): MessageEvent => ({ type: 'unread-count', data: { count } })),
    );
    const pings = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: {} })),
    );
    const end = merge(
      this.closed.pipe(filter((id) => id === userId)),
      this.shutdown,
      expiresAt === undefined ? NEVER : timer(Math.max(0, expiresAt - Date.now())),
    );
    return merge(counts, pings).pipe(takeUntil(end));
  }

  onModuleDestroy(): void {
    this.shutdown.next();
  }
}
