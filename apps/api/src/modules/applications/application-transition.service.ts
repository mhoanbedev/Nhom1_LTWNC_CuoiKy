import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  canTransition,
  ErrorCode,
  type ApplicationActor,
  type ApplicationStatus,
} from '@ltwnc/shared';
import { DataSource } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { ApplicationStatusHistory } from './entities/application-status-history.entity';
import { Application } from './entities/application.entity';

export interface TransitionRequest {
  application: Pick<Application, 'id' | 'status'>;
  to: ApplicationStatus;
  actor: ApplicationActor;
  changedById: string;
  note: string | null;
}

/**
 * Đổi trạng thái đơn theo bảng mục 5.4 (dùng chung cho rút đơn và nhà tuyển dụng đổi trạng thái):
 * - Không có trong bảng `canTransition` → 400 APPLICATION_INVALID_TRANSITION.
 * - Cập nhật có điều kiện `WHERE id = ? AND status = <trạng thái vừa đọc>`: người khác vừa đổi
 *   trước (không khớp dòng nào) → 409 APPLICATION_STATUS_CONFLICT, không ghi đè nhau.
 * - Đổi trạng thái và ghi lịch sử trong một transaction.
 */
@Injectable()
export class ApplicationTransitionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async transition(request: TransitionRequest): Promise<void> {
    const { application, to, actor, changedById, note } = request;
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
    });
  }
}
