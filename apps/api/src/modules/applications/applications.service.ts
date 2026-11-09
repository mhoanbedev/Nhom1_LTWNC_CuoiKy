import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  ApplicationActor,
  ApplicationStatus,
  ErrorCode,
  profileCompletion,
  ValidationMessage,
  type ApplyInput,
  type CandidateApplication,
  type CandidateApplicationListItem,
  type Locale,
  type MyApplicationsQuery,
  type Paginated,
  type ProfileSnapshot,
} from '@ltwnc/shared';
import { DataSource, Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { paginate, toSkipTake } from '../../common/utils/paginate';
import { isUniqueViolation } from '../../database/pg-errors';
import { CvsService } from '../cvs/cvs.service';
import { Job } from '../jobs/entities/job.entity';
import { isOpen, isViewable } from '../jobs/public-jobs.service';
import { ProfilesService } from '../profiles/profiles.service';
import { UsersService } from '../users/users.service';
import { ApplicationTransitionService } from './application-transition.service';
import { toCandidateApplication, toCandidateApplicationListItem } from './application.mapper';
import { ApplicationStatusHistory } from './entities/application-status-history.entity';
import { Application } from './entities/application.entity';

const JOB_RELATIONS = { translations: true, company: { translations: true } } as const;

/** Nộp đơn và đơn của ứng viên (mục 5.3 của đặc tả). */
@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly profilesService: ProfilesService,
    private readonly cvsService: CvsService,
    private readonly usersService: UsersService,
    private readonly transitions: ApplicationTransitionService,
  ) {}

  /**
   * Nộp đơn, kiểm lần lượt đúng thứ tự mục 5.3 (bước 1, người gọi là ứng viên, do @Roles kiểm):
   * 2. tin tồn tại và công khai (không thì 404; đã đóng hay hết hạn thì 400 JOB_NOT_ACCEPTING);
   * 3. hồ sơ xong 3 bước bắt buộc (400 PROFILE_INCOMPLETE, `details` là bước còn thiếu);
   * 4. CV của chính ứng viên và chưa xóa (400 CV_INVALID);
   * 5. chưa nộp tin này (409 APPLICATION_DUPLICATE): kiểm bằng ràng buộc unique của DB, nên bấm
   *    nộp hai lần cùng lúc cũng chỉ tạo một đơn.
   * Tạo đơn kèm ảnh chụp hồ sơ và dòng lịch sử đầu tiên trong một transaction.
   */
  async apply(
    candidateId: string,
    jobId: string,
    input: ApplyInput,
    lang: Locale,
  ): Promise<CandidateApplication> {
    const job = await this.jobs.findOne({ where: { id: jobId }, relations: { company: true } });
    if (!job || !isViewable(job)) throw new AppException(ErrorCode.NOT_FOUND);
    if (!isOpen(job)) throw new AppException(ErrorCode.JOB_NOT_ACCEPTING);

    const completion = profileCompletion(await this.profilesService.completedSteps(candidateId));
    if (!completion.canApply) {
      throw new AppException(
        ErrorCode.PROFILE_INCOMPLETE,
        undefined,
        completion.missingRequired.map((step) => ({
          field: step,
          message: ValidationMessage.PROFILE_STEP_INCOMPLETE,
        })),
      );
    }

    const cv = await this.cvsService.findUsable(candidateId, input.cvFileId);
    if (!cv) throw new AppException(ErrorCode.CV_INVALID);

    const snapshot = await this.takeSnapshot(candidateId);
    let applicationId: string;
    try {
      applicationId = await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(Application);
        const application = await repository.save(
          repository.create({
            jobId: job.id,
            candidateId,
            cvFileId: cv.id,
            coverLetter: input.coverLetter ?? null,
            status: ApplicationStatus.SUBMITTED,
            profileSnapshot: snapshot,
            submittedAt: new Date(),
          }),
        );
        await manager.getRepository(ApplicationStatusHistory).insert({
          applicationId: application.id,
          fromStatus: null,
          toStatus: ApplicationStatus.SUBMITTED,
          changedById: candidateId,
          note: null,
        });
        return application.id;
      });
    } catch (error) {
      if (isUniqueViolation(error, 'uq_applications_job_candidate')) {
        throw new AppException(ErrorCode.APPLICATION_DUPLICATE);
      }
      throw error;
    }
    return this.getMine(candidateId, applicationId, lang);
  }

  /** Đơn của ứng viên, mới nộp lên trước. */
  async listMine(
    candidateId: string,
    query: MyApplicationsQuery,
    lang: Locale,
  ): Promise<Paginated<CandidateApplicationListItem>> {
    const { skip, take } = toSkipTake(query);
    const [rows, total] = await this.applications.findAndCount({
      where: { candidateId, ...(query.status ? { status: query.status } : {}) },
      relations: { job: JOB_RELATIONS },
      order: { submittedAt: 'DESC', id: 'ASC' },
      skip,
      take,
    });
    return paginate(
      rows.map((row) => toCandidateApplicationListItem(row, lang)),
      total,
      query,
    );
  }

  /** Rút đơn: chỉ khi đơn còn mở (SUBMITTED, REVIEWING, INTERVIEW); đơn người khác trả 404. */
  async withdraw(candidateId: string, id: string, lang: Locale): Promise<CandidateApplication> {
    const application = await this.applications.findOneBy({ id, candidateId });
    if (!application) throw new AppException(ErrorCode.NOT_FOUND);
    await this.transitions.transition({
      application,
      to: ApplicationStatus.WITHDRAWN,
      actor: ApplicationActor.CANDIDATE,
      changedById: candidateId,
      note: null,
    });
    return this.getMine(candidateId, id, lang);
  }

  /** Chi tiết đơn của chính ứng viên kèm lịch sử; đơn người khác trả 404. */
  async getMine(candidateId: string, id: string, lang: Locale): Promise<CandidateApplication> {
    const application = await this.applications.findOne({
      where: { id, candidateId },
      relations: { job: JOB_RELATIONS, cvFile: true, history: true },
    });
    if (!application) throw new AppException(ErrorCode.NOT_FOUND);
    return toCandidateApplication(application, lang);
  }

  private async takeSnapshot(candidateId: string): Promise<ProfileSnapshot> {
    const user = await this.usersService.findById(candidateId);
    if (!user) throw new AppException(ErrorCode.NOT_FOUND);
    return {
      candidate: { name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      profile: await this.profilesService.snapshot(candidateId),
      takenAt: new Date().toISOString(),
    };
  }
}
