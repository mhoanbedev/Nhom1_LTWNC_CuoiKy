import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ApplicationActor, ApplicationStatus, ErrorCode, NotificationType } from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { Job } from '../jobs/entities/job.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ApplicationStatusEmailService } from './application-status-email.service';
import { ApplicationTransitionService } from './application-transition.service';
import { ApplicationNote } from './entities/application-note.entity';
import { ApplicationStatusHistory } from './entities/application-status-history.entity';
import { Application } from './entities/application.entity';
import { RecruiterApplicationsService } from './recruiter-applications.service';

async function codeOf(promise: Promise<unknown>): Promise<ErrorCode | undefined> {
  const error = await promise.catch((e: unknown) => e);
  return error instanceof AppException ? error.code : undefined;
}

describe('changeStatus (ApplicationTransitionService + RecruiterApplicationsService)', () => {
  const applicationRepo = { update: jest.fn<Promise<{ affected?: number }>, [object, object]>() };
  const historyRepo = { insert: jest.fn<Promise<unknown>, [object]>() };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === ApplicationStatusHistory ? historyRepo : applicationRepo,
  };
  const dataSource = {
    transaction: jest.fn((run: (m: typeof manager) => Promise<unknown>) => run(manager)),
  };
  const applications = { findOne: jest.fn<Promise<Application | null>, [object]>() };
  const notifications = { create: jest.fn<Promise<void>, [unknown, string, object]>() };
  const statusEmails = { notify: jest.fn<void, [Application, string, string | null]>() };
  let transitions: ApplicationTransitionService;
  let service: RecruiterApplicationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    applicationRepo.update.mockResolvedValue({ affected: 1 });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ApplicationTransitionService,
        RecruiterApplicationsService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(Application), useValue: applications },
        { provide: getRepositoryToken(Job), useValue: {} },
        { provide: getRepositoryToken(ApplicationNote), useValue: {} },
        { provide: NotificationsService, useValue: notifications },
        { provide: ApplicationStatusEmailService, useValue: statusEmails },
      ],
    }).compile();
    transitions = moduleRef.get(ApplicationTransitionService);
    service = moduleRef.get(RecruiterApplicationsService);
    jest.spyOn(service, 'get').mockResolvedValue({} as never);
  });

  const submitted = { id: 'app-1', status: ApplicationStatus.SUBMITTED };
  const notify = {
    userId: 'candidate-1',
    payload: {
      type: NotificationType.APPLICATION_STATUS_CHANGED,
      data: {
        applicationId: 'app-1',
        jobId: 'job-1',
        jobTitle: { vi: 'Thực tập', en: null },
        fromStatus: ApplicationStatus.SUBMITTED,
        toStatus: ApplicationStatus.REVIEWING,
        note: null,
        candidateName: null,
      },
    },
  } as const;

  it('đơn vào tin công ty khác (không tìm thấy theo companyId): 404, không đổi gì', async () => {
    applications.findOne.mockResolvedValue(null);
    expect(
      await codeOf(
        service.changeStatus(
          'hr-2',
          'company-b',
          'app-1',
          { to: ApplicationStatus.REVIEWING },
          'vi',
        ),
      ),
    ).toBe(ErrorCode.NOT_FOUND);
    expect(applications.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'app-1', job: { companyId: 'company-b' } } }),
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('chuyển sai bảng (nhảy cóc): 400 APPLICATION_INVALID_TRANSITION, không mở transaction', async () => {
    expect(
      await codeOf(
        transitions.transition({
          application: submitted,
          to: ApplicationStatus.PASSED,
          actor: ApplicationActor.RECRUITER,
          changedById: 'hr-1',
          note: null,
          notify,
        }),
      ),
    ).toBe(ErrorCode.APPLICATION_INVALID_TRANSITION);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('người khác vừa đổi trước (UPDATE có điều kiện không khớp): 409, không ghi lịch sử', async () => {
    applicationRepo.update.mockResolvedValue({ affected: 0 });
    expect(
      await codeOf(
        transitions.transition({
          application: submitted,
          to: ApplicationStatus.REVIEWING,
          actor: ApplicationActor.RECRUITER,
          changedById: 'hr-1',
          note: null,
          notify,
        }),
      ),
    ).toBe(ErrorCode.APPLICATION_STATUS_CONFLICT);
    expect(historyRepo.insert).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('thành công: UPDATE kèm điều kiện trạng thái cũ, ghi lịch sử kèm ghi chú', async () => {
    applications.findOne.mockResolvedValue({
      ...submitted,
      jobId: 'job-1',
      candidateId: 'candidate-1',
      job: { translations: [{ locale: 'vi', title: 'Thực tập' }] },
    } as Application);
    await service.changeStatus(
      'hr-1',
      'company-a',
      'app-1',
      { to: ApplicationStatus.REVIEWING, note: 'Đã xem CV' },
      'vi',
    );
    expect(applicationRepo.update).toHaveBeenCalledWith(
      { id: 'app-1', status: 'SUBMITTED' },
      { status: 'REVIEWING' },
    );
    expect(historyRepo.insert).toHaveBeenCalledWith({
      applicationId: 'app-1',
      fromStatus: 'SUBMITTED',
      toStatus: 'REVIEWING',
      changedById: 'hr-1',
      note: 'Đã xem CV',
    });
    // Báo ứng viên trong cùng transaction, kèm ghi chú.
    expect(notifications.create).toHaveBeenCalledWith(manager, 'candidate-1', {
      type: 'APPLICATION_STATUS_CHANGED',
      data: {
        applicationId: 'app-1',
        jobId: 'job-1',
        jobTitle: { vi: 'Thực tập', en: null },
        fromStatus: 'SUBMITTED',
        toStatus: 'REVIEWING',
        note: 'Đã xem CV',
        candidateName: null,
      },
    });
    // Email chỉ gọi sau khi đổi trạng thái xong; service email tự lọc trạng thái cần gửi.
    expect(statusEmails.notify).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'app-1' }),
      'REVIEWING',
      'Đã xem CV',
    );
  });

  it('đổi trạng thái lỗi (409) thì không gọi email', async () => {
    applications.findOne.mockResolvedValue({
      ...submitted,
      status: ApplicationStatus.REVIEWING,
      jobId: 'job-1',
      candidateId: 'candidate-1',
      job: { translations: [{ locale: 'vi', title: 'Thực tập' }] },
    } as Application);
    applicationRepo.update.mockResolvedValue({ affected: 0 });
    expect(
      await codeOf(
        service.changeStatus(
          'hr-1',
          'company-a',
          'app-1',
          { to: ApplicationStatus.INTERVIEW },
          'vi',
        ),
      ),
    ).toBe(ErrorCode.APPLICATION_STATUS_CONFLICT);
    expect(statusEmails.notify).not.toHaveBeenCalled();
  });
});
