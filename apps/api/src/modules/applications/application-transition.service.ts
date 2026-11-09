import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  canTransition,
  ErrorCode,
  type ApplicationActor,
  type ApplicationStatus,
  type NotificationPayload,
} from '@ltwnc/shared';
import { DataSource } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { NotificationsService } from '../notifications/notifications.service';
import { ApplicationStatusHistory } from './entities/application-status-history.entity';
import { Application } from './entities/application.entity';

export interface TransitionRequest {
  application: Pick<Application, 'id' | 'status'>;
  to: ApplicationStatus;
  actor: ApplicationActor;
  changedById: string;
  note: string | null;
  /** Thông báo cho bên còn lại, tạo trong cùng transaction với việc đổi trạng thái. */
  notify: { userId: string; payload: NotificationPayload };
}

/**
 * Đổi trạng thái đơn theo bảng mục 5.4 (dùng chung cho rút đơn và nhà tuyển dụng đổi trạng thái):
 * - Không có trong bảng `canTransition` → 400 APPLICATION_INVALID_TRANSITION.
 * - Cập nhật có điều kiện `WHERE id = ? AND status = <trạng thái vừa đọc>`: người khác vừa đổi
 *   trước (không khớp dòng nào) → 409 APPLICATION_STATUS_CONFLICT, không ghi đè nhau.
 * - Đổi trạng thái, ghi lịch sử và tạo thông báo cho bên còn lại trong một transaction.
 */
@Injectable()
export class ApplicationTransitionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async transition(request: TransitionRequest): Promise<void> {
    const { application, to, actor, changedById, note, notify } = request;
    if (!canTransition(application.status, to, actor)) {
      throw new AppException(ErrorCode.APPLICATION_INVALID_TRANSITION);
    }
    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .getRepository(Application)
        .update({ id: application.id, status: application.status }, { status: to });
      if (!result.affected) throw new AppException(ErrorCode.APPLICATION_STATUS_CONFLICT);
      await manager.getRepository(ApplicationStatusHistory).insert({
        applicationId: application.id,
        fromStatus: application.status,
        toStatus: to,
        changedById,
        note,
      });
      await this.notifications.create(manager, notify.userId, notify.payload);
    });
  }
}
