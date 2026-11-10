import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationCommitSubscriber } from './notification-commit.subscriber';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationsService } from './notifications.service';

/**
 * Module khác import để tạo thông báo trong transaction của mình (NotificationsService.create), hoặc
 * đóng stream SSE của một người (NotificationStreamService.close).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationStreamService, NotificationCommitSubscriber],
  exports: [NotificationsService, NotificationStreamService],
})
export class NotificationsModule {}
