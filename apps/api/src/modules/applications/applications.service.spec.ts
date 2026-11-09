import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  CompanyStatus,
  ErrorCode,
  JobStatus,
  ProfileStep,
  type CandidateApplication,
} from '@ltwnc/shared';
import { QueryFailedError } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { CvsService } from '../cvs/cvs.service';
import type { CvFile } from '../cvs/entities/cv-file.entity';
import { Job } from '../jobs/entities/job.entity';
import { ProfilesService } from '../profiles/profiles.service';
import type { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ApplicationsService } from './applications.service';
import { ApplicationStatusHistory } from './entities/application-status-history.entity';
import { Application } from './entities/application.entity';

const CANDIDATE = 'candidate-1';
const JOB = 'job-1';
const CV = 'cv-1';
const input = { cvFileId: CV, coverLetter: 'Em xin ứng tuyển' };
const ALL_REQUIRED = [ProfileStep.BASIC, ProfileStep.EDUCATION, ProfileStep.SKILLS];

const openJob = (overrides: Partial<Job> = {}): Job =>
  ({
    id: JOB,
    status: JobStatus.PUBLISHED,
    isHidden: false,
    expiresAt: new Date(Date.now() + 86_400_000),
    company: { status: CompanyStatus.APPROVED },
    ...overrides,
  }) as Job;

async function errorOf(
  promise: Promise<unknown>,
): Promise<{ code?: ErrorCode; details?: unknown }> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppException);
  return { code: (error as AppException).code, details: (error as AppException).details };
}

describe('ApplicationsService.apply', () => {
  const jobs = { findOne: jest.fn<Promise<Job | null>, [object]>() };
  const profiles = {
    completedSteps: jest.fn<Promise<ProfileStep[]>, [string]>(),
    snapshot: jest.fn(),
  };
  const cvs = { findUsable: jest.fn<Promise<CvFile | null>, [string, string]>() };
  const users = { findById: jest.fn<Promise<User | null>, [string]>() };
  /** Repository giả trong transaction: ghi lại đơn và lịch sử đã tạo. */
  const applicationRepo = {
    create: jest.fn((data: Partial<Application>) => data),
    save: jest.fn((data: Partial<Application>) => Promise.resolve({ ...data, id: 'app-1' })),
  };
  const historyRepo = { insert: jest.fn<Promise<unknown>, [object]>() };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === ApplicationStatusHistory ? historyRepo : applicationRepo,
  };
  const dataSource = {
    transaction: jest.fn((run: (m: typeof manager) => Promise<unknown>) => run(manager)),
  };
  let service: ApplicationsService;
  let getMine: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    jobs.findOne.mockResolvedValue(openJob());
    profiles.completedSteps.mockResolvedValue(ALL_REQUIRED);
    profiles.snapshot.mockResolvedValue({ basic: null, education: [], skills: [], projects: [] });
    cvs.findUsable.mockResolvedValue({ id: CV } as CvFile);
    users.findById.mockResolvedValue({ name: 'An', email: 'an@x.vn', avatarUrl: null } as User);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: getRepositoryToken(Application), useValue: {} },
        { provide: getRepositoryToken(Job), useValue: jobs },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: ProfilesService, useValue: profiles },
        { provide: CvsService, useValue: cvs },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    service = moduleRef.get(ApplicationsService);
    getMine = jest
      .spyOn(service, 'getMine')
      .mockResolvedValue({ id: 'app-1' } as CandidateApplication);
  });

  it('thành công: tạo đơn SUBMITTED kèm ảnh chụp hồ sơ và dòng lịch sử null → SUBMITTED', async () => {
    await expect(service.apply(CANDIDATE, JOB, input, 'vi')).resolves.toEqual({ id: 'app-1' });
    expect(applicationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: JOB,
        candidateId: CANDIDATE,
        cvFileId: CV,
        coverLetter: 'Em xin ứng tuyển',
        status: 'SUBMITTED',
        profileSnapshot: expect.objectContaining({
          candidate: { name: 'An', email: 'an@x.vn', avatarUrl: null },
        }) as unknown,
      }),
    );
    expect(historyRepo.insert).toHaveBeenCalledWith({
      applicationId: 'app-1',
      fromStatus: null,
      toStatus: 'SUBMITTED',
      changedById: CANDIDATE,
      note: null,
    });
    expect(getMine).toHaveBeenCalledWith(CANDIDATE, 'app-1', 'vi');
  });

  it.each([
    ['tin không tồn tại', null],
    ['tin nháp', openJob({ status: JobStatus.DRAFT })],
    ['tin bị ẩn', openJob({ isHidden: true })],
    ['công ty chưa duyệt', openJob({ company: { status: CompanyStatus.PENDING } } as Partial<Job>)],
  ])('nhánh 2: %s → 404', async (_label, job) => {
    jobs.findOne.mockResolvedValue(job);
    expect((await errorOf(service.apply(CANDIDATE, JOB, input, 'vi'))).code).toBe(
      ErrorCode.NOT_FOUND,
    );
  });

  it.each([
    ['tin đã đóng', openJob({ status: JobStatus.CLOSED })],
    ['tin hết hạn', openJob({ expiresAt: new Date(Date.now() - 1000) })],
  ])('nhánh 2: %s → 400 JOB_NOT_ACCEPTING', async (_label, job) => {
    jobs.findOne.mockResolvedValue(job);
    expect((await errorOf(service.apply(CANDIDATE, JOB, input, 'vi'))).code).toBe(
      ErrorCode.JOB_NOT_ACCEPTING,
    );
  });

  it('nhánh 3: hồ sơ thiếu bước bắt buộc → 400 PROFILE_INCOMPLETE, details là bước còn thiếu', async () => {
    profiles.completedSteps.mockResolvedValue([ProfileStep.BASIC]);
    const error = await errorOf(service.apply(CANDIDATE, JOB, input, 'vi'));
    expect(error.code).toBe(ErrorCode.PROFILE_INCOMPLETE);
    expect(error.details).toEqual([
      { field: 'EDUCATION', message: 'PROFILE_STEP_INCOMPLETE' },
      { field: 'SKILLS', message: 'PROFILE_STEP_INCOMPLETE' },
    ]);
    expect(cvs.findUsable).not.toHaveBeenCalled();
  });

  it('nhánh 4: CV không phải của mình hoặc đã xóa → 400 CV_INVALID', async () => {
    cvs.findUsable.mockResolvedValue(null);
    expect((await errorOf(service.apply(CANDIDATE, JOB, input, 'vi'))).code).toBe(
      ErrorCode.CV_INVALID,
    );
    expect(cvs.findUsable).toHaveBeenCalledWith(CANDIDATE, CV);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('nhánh 5: đã nộp (DB báo trùng unique) → 409 APPLICATION_DUPLICATE', async () => {
    applicationRepo.save.mockRejectedValueOnce(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate'), {
          code: '23505',
          constraint: 'uq_applications_job_candidate',
        }),
      ),
    );
    expect((await errorOf(service.apply(CANDIDATE, JOB, input, 'vi'))).code).toBe(
      ErrorCode.APPLICATION_DUPLICATE,
    );
    expect(historyRepo.insert).not.toHaveBeenCalled();
  });
});
