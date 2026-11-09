import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ApplicationActor,
  ErrorCode,
  type ApplicationNote as ApplicationNoteDto,
  type ChangeApplicationStatusInput,
  type CreateApplicationNoteInput,
  type Locale,
  type Paginated,
  type RecruiterApplication,
  type RecruiterApplicationListItem,
  type RecruiterApplicationsQuery,
} from '@ltwnc/shared';
import { Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { paginate, toSkipTake } from '../../common/utils/paginate';
import { Job } from '../jobs/entities/job.entity';
import { ApplicationTransitionService } from './application-transition.service';
import {
  toNotes,
  toRecruiterApplication,
  toRecruiterApplicationListItem,
} from './application.mapper';
import { ApplicationNote } from './entities/application-note.entity';
import { Application } from './entities/application.entity';

/**
 * Đơn ứng tuyển phía nhà tuyển dụng: chỉ đơn nộp vào tin của công ty mình. Đơn hay tin của công ty
 * khác trả 404 như không tồn tại (mục 2 của đặc tả). Trạng thái công ty và tin không chặn việc xử lý
 * đơn đã có: đóng tin hay bị thu hồi duyệt chỉ ngừng nhận đơn mới, ứng viên vẫn cần nhận kết quả.
 */
@Injectable()
export class RecruiterApplicationsService {
  constructor(
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(ApplicationNote) private readonly notes: Repository<ApplicationNote>,
    private readonly transitions: ApplicationTransitionService,
  ) {}

  /** Đơn của một tin, mới nộp lên trước; lọc theo `status`. */
  async listForJob(
    companyId: string | null,
    jobId: string,
    query: RecruiterApplicationsQuery,
  ): Promise<Paginated<RecruiterApplicationListItem>> {
    const owned = await this.jobs.existsBy({ id: jobId, companyId: requireCompany(companyId) });
    if (!owned) throw new AppException(ErrorCode.NOT_FOUND);
    const { skip, take } = toSkipTake(query);
    const [rows, total] = await this.applications.findAndCount({
      where: { jobId, ...(query.status ? { status: query.status } : {}) },
      relations: { cvFile: true },
      order: { submittedAt: 'DESC', id: 'ASC' },
      skip,
      take,
    });
    return paginate(rows.map(toRecruiterApplicationListItem), total, query);
  }

  async get(companyId: string | null, id: string, lang: Locale): Promise<RecruiterApplication> {
    return toRecruiterApplication(await this.findOwned(companyId, id), lang);
  }

  /** Đổi trạng thái theo bảng mục 5.4; `note` ghi vào lịch sử, ứng viên cũng thấy. */
  async changeStatus(
    recruiterId: string,
    companyId: string | null,
    id: string,
    input: ChangeApplicationStatusInput,
    lang: Locale,
  ): Promise<RecruiterApplication> {
    const application = await this.findOwned(companyId, id);
    await this.transitions.transition({
      application,
      to: input.to,
      actor: ApplicationActor.RECRUITER,
      changedById: recruiterId,
      note: input.note ?? null,
    });
    return this.get(companyId, id, lang);
  }

  /** Ghi chú nội bộ của đơn, mới nhất lên trước. */
  async listNotes(companyId: string | null, id: string): Promise<ApplicationNoteDto[]> {
    await this.assertOwned(companyId, id);
    const rows = await this.notes.find({
      where: { applicationId: id },
      relations: { author: true },
    });
    return toNotes(rows);
  }

  /** Thêm ghi chú nội bộ (chỉ thêm, không sửa, không xóa); trả cả danh sách sau khi thêm. */
  async addNote(
    recruiterId: string,
    companyId: string | null,
    id: string,
    input: CreateApplicationNoteInput,
  ): Promise<ApplicationNoteDto[]> {
    await this.assertOwned(companyId, id);
    await this.notes.insert({ applicationId: id, authorId: recruiterId, content: input.content });
    return this.listNotes(companyId, id);
  }

  /** Đơn vào tin của công ty mình; không thì 404. Nhẹ hơn findOwned khi không cần dữ liệu đơn. */
  private async assertOwned(companyId: string | null, id: string): Promise<void> {
    const owned = await this.applications.existsBy({
      id,
      job: { companyId: requireCompany(companyId) },
    });
    if (!owned) throw new AppException(ErrorCode.NOT_FOUND);
  }

  private async findOwned(companyId: string | null, id: string): Promise<Application> {
    const application = await this.applications.findOne({
      where: { id, job: { companyId: requireCompany(companyId) } },
      relations: {
        job: { translations: true, company: { translations: true } },
        cvFile: true,
        history: true,
        notes: { author: true },
      },
    });
    if (!application) throw new AppException(ErrorCode.NOT_FOUND);
    return application;
  }
}

/** Nhà tuyển dụng luôn có công ty (tạo cùng lúc đăng ký); thiếu là token không hợp lệ. */
function requireCompany(companyId: string | null): string {
  if (!companyId) throw new AppException(ErrorCode.FORBIDDEN);
  return companyId;
}
