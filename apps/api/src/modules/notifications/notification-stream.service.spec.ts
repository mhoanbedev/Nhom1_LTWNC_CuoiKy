import type { MessageEvent } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { QueryRunner } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { HEARTBEAT_MS, NotificationStreamService } from './notification-stream.service';

/** QueryRunner giả: chỉ cần `isTransactionActive` và `data`. */
const runner = (isTransactionActive: boolean) =>
  ({ isTransactionActive, data: {} }) as unknown as QueryRunner;

describe('NotificationStreamService', () => {
  const notifications = { countBy: jest.fn<Promise<number>, [object]>() };
  let service: NotificationStreamService;

  beforeEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
    notifications.countBy.mockResolvedValue(3);
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationStreamService,
        { provide: getRepositoryToken(Notification), useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(NotificationStreamService);
  });

  /** Gom sự kiện của một stream; `done` true khi stream đã đóng. */
  function collect(userId: string, expiresAt?: number) {
    const events: MessageEvent[] = [];
    const state = { done: false };
    const subscription = service.stream(userId, expiresAt).subscribe({
      next: (event) => events.push(event),
      complete: () => (state.done = true),
    });
    return { events, state, subscription };
  }

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('kết nối xong gửi ngay số chưa đọc; số đổi thì gửi lại, chỉ cho đúng người', async () => {
    const mine = collect('user-1');
    const other = collect('user-2');
    await flush();
    expect(mine.events).toEqual([{ type: 'unread-count', data: { count: 3 } }]);

    notifications.countBy.mockResolvedValue(4);
    service.publish('user-1');
    await flush();
    expect(mine.events.at(-1)).toEqual({ type: 'unread-count', data: { count: 4 } });
    expect(other.events).toHaveLength(1);
    mine.subscription.unsubscribe();
    other.subscription.unsubscribe();
  });

  it('trong transaction: chỉ ghi tạm, lấy ra một lần (commit thì đẩy, rollback thì bỏ)', () => {
    const tx = runner(true);
    service.publishAfterCommit(tx, 'user-1');
    service.publishAfterCommit(tx, 'user-1');
    service.publishAfterCommit(tx, 'user-2');
    expect(service.takePending(tx)).toEqual(['user-1', 'user-2']);
    expect(service.takePending(tx)).toEqual([]);
  });

  it('ngoài transaction thì đẩy ngay', async () => {
    const stream = collect('user-1');
    await flush();
    service.publishAfterCommit(runner(false), 'user-1');
    await flush();
    service.publishAfterCommit(undefined, 'user-1');
    await flush();
    expect(stream.events).toHaveLength(3);
    stream.subscription.unsubscribe();
  });

  it('nhiều lần đổi dồn dập chỉ gửi số mới nhất', async () => {
    const stream = collect('user-1');
    await flush();
    notifications.countBy.mockResolvedValueOnce(4).mockResolvedValueOnce(5);
    service.publish('user-1');
    service.publish('user-1');
    await flush();
    expect(stream.events.map((event) => event.data)).toEqual([{ count: 3 }, { count: 5 }]);
    stream.subscription.unsubscribe();
  });

  it('close(userId) đóng stream của người đó', async () => {
    const stream = collect('user-1');
    await flush();
    service.close('user-2');
    expect(stream.state.done).toBe(false);
    service.close('user-1');
    expect(stream.state.done).toBe(true);
  });

  it('gửi ping định kỳ; đóng khi access token hết hạn', () => {
    jest.useFakeTimers();
    const stream = collect('user-1', Date.now() + HEARTBEAT_MS * 2 + 1000);
    jest.advanceTimersByTime(HEARTBEAT_MS);
    expect(stream.events).toContainEqual({ type: 'ping', data: {} });
    expect(stream.state.done).toBe(false);
    jest.advanceTimersByTime(HEARTBEAT_MS * 2);
    expect(stream.state.done).toBe(true);
  });

  it('app tắt thì mọi stream đóng', () => {
    const stream = collect('user-1');
    service.onModuleDestroy();
    expect(stream.state.done).toBe(true);
  });
});
