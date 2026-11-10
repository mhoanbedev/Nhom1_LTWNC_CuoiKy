import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ErrorCode, JobStatus } from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { RevalidateService } from '../../infrastructure/revalidate/revalidate.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Job } from './entities/job.entity';
import { JobsAdminService } from './jobs-admin.service';
import { jobTags } from './recruiter-jobs.service';

const NOW = new Date('2026-11-10T00:00:00.000Z');

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    shortId: 'a1b2c3',
    companyId: 'company-1',
    company: {
      id: 'company-1',
      ownerId: 'hr-1',
      translations: [{ locale: 'vi', name: 'Công ty A' }],
    },
    status: JobStatus.PUBLISHED,
    isHidden: false,
    hiddenReason: null,
    translations: [
      { locale: 'vi', title: 'Thực tập Backend' },
      { locale: 'en', title: 'Backend intern' },
    ],
    expiresAt: null,
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Job;
}

describe('JobsAdminService', () => {
  const managerJobs = { update: jest.fn<Promise<{ affected?: number }>, [object, object]>() };
  const manager = { getRepository: jest.fn(() => managerJobs) };
  const jobs = {
    findOne: jest.fn<Promise<Job | null>, [object]>(),
    update: jest.fn<Promise<{ affected?: number }>, [object, object]>(),
  };
  const dataSource = {
    transaction: jest.fn((run: (m: typeof manager) => Promise<unknown>) => run(manager)),
  };
  const notifications = { create: jest.fn<Promise<void>, [unknown, string, object]>() };
  const revalidate = { notify: jest.fn<void, [string[]]>() };
  let service: JobsAdminService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        JobsAdminService,
        { provide: getRepositoryToken(Job), useValue: jobs },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: NotificationsService, useValue: notifications },
        { provide: RevalidateService, useValue: revalidate },
      ],
    }).compile();
    service = moduleRef.get(JobsAdminService);
  });

  describe('hide', () => {
    it('ẩn lần đầu: ghi lý do, báo chủ tin cùng transaction, revalidate trang tin', async () => {
      jobs.findOne
        .mockResolvedValueOnce(job())
        .mockResolvedValueOnce(job({ isHidden: true, hiddenReason: 'Tin lừa đảo' }));
      managerJobs.update.mockResolvedValue({ affected: 1 });

      const result = await service.hide('job-1', 'Tin lừa đảo');

      expect(managerJobs.update).toHaveBeenCalledWith(
        { id: 'job-1', isHidden: false },
        { isHidden: true, hiddenReason: 'Tin lừa đảo' },
      );
      expect(notifications.create).toHaveBeenCalledWith(manager, 'hr-1', {
        type: 'JOB_HIDDEN',
        data: {
          jobId: 'job-1',
          jobTitle: { vi: 'Thực tập Backend', en: 'Backend intern' },
          reason: 'Tin lừa đảo',
        },
      });
      expect(revalidate.notify).toHaveBeenCalledWith(jobTags(job()));
      expect(result).toMatchObject({
        isHidden: true,
        hiddenReason: 'Tin lừa đảo',
        status: 'PUBLISHED',
        title: 'Thực tập Backend',
        titleEn: 'Backend intern',
        company: { id: 'company-1', name: 'Công ty A' },
      });
    });

    it('tin đang ẩn: giữ lý do cũ, không báo lại, không revalidate', async () => {
      jobs.findOne.mockResolvedValue(job({ isHidden: true, hiddenReason: 'Lý do cũ' }));
      managerJobs.update.mockResolvedValue({ affected: 0 });

      const result = await service.hide('job-1', 'Lý do mới');

      expect(notifications.create).not.toHaveBeenCalled();
      expect(revalidate.notify).not.toHaveBeenCalled();
      expect(result.hiddenReason).toBe('Lý do cũ');
    });

    it('tin không tồn tại: 404, không mở transaction', async () => {
      jobs.findOne.mockResolvedValue(null);
      const error = await service.hide('job-x', 'Tin lừa đảo').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).code).toBe(ErrorCode.NOT_FOUND);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('unhide', () => {
    it('bỏ ẩn: xóa lý do, tin về trạng thái cũ, revalidate', async () => {
      jobs.findOne
        .mockResolvedValueOnce(job({ isHidden: true, hiddenReason: 'Tin lừa đảo' }))
        .mockResolvedValueOnce(job({ status: JobStatus.CLOSED }));
      jobs.update.mockResolvedValue({ affected: 1 });

      const result = await service.unhide('job-1');

      expect(jobs.update).toHaveBeenCalledWith(
        { id: 'job-1', isHidden: true },
        { isHidden: false, hiddenReason: null },
      );
      expect(revalidate.notify).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ isHidden: false, hiddenReason: null, status: 'CLOSED' });
    });

    it('tin không bị ẩn: giữ nguyên, không revalidate', async () => {
      jobs.findOne.mockResolvedValue(job());
      jobs.update.mockResolvedValue({ affected: 0 });
      await service.unhide('job-1');
      expect(revalidate.notify).not.toHaveBeenCalled();
    });

    it('tin không tồn tại: 404', async () => {
      jobs.findOne.mockResolvedValue(null);
      await expect(service.unhide('job-x')).rejects.toBeInstanceOf(AppException);
      expect(jobs.update).not.toHaveBeenCalled();
    });
  });
});
