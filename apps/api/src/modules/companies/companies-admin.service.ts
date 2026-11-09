import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CompanyStatus,
  ErrorCode,
  type AdminCompaniesQuery,
  type AdminCompany,
  type Paginated,
} from '@ltwnc/shared';
import { Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { paginate, toSkipTake } from '../../common/utils/paginate';
import { containsPattern } from '../../common/utils/search';
import { RevalidateService } from '../../infrastructure/revalidate/revalidate.service';
import { companyTags } from './company-tags';
import { toAdminCompany } from './company.mapper';
import { Company } from './entities/company.entity';

/** Duyệt doanh nghiệp phía admin (mục 5.1 của đặc tả). */
@Injectable()
export class CompaniesAdminService {
  constructor(
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    private readonly revalidate: RevalidateService,
  ) {}

  /** Mới đăng ký lên trước. `q` tìm trên tên cả hai ngôn ngữ, gõ không dấu được. */
  async list(query: AdminCompaniesQuery): Promise<Paginated<AdminCompany>> {
    const builder = this.companies
      .createQueryBuilder('company')
      .leftJoinAndSelect('company.translations', 'translation')
      .leftJoinAndSelect('company.owner', 'owner')
      .orderBy('company.createdAt', 'DESC')
      .addOrderBy('company.id', 'ASC');
    if (query.status) builder.andWhere('company.status = :status', { status: query.status });
    if (query.q) {
      builder.andWhere(
        `EXISTS (SELECT 1 FROM company_translations ct
          WHERE ct.company_id = company.id AND ct.search_text LIKE :q)`,
        { q: containsPattern(query.q) },
      );
    }
    const { skip, take } = toSkipTake(query);
    const [rows, total] = await builder.skip(skip).take(take).getManyAndCount();
    return paginate(rows.map(toAdminCompany), total, query);
  }

  /** Duyệt: công ty đăng được tin. Gọi lại khi đã duyệt thì giữ nguyên (idempotent). */
  async approve(id: string): Promise<AdminCompany> {
    const company = await this.findById(id);
    if (company.status !== CompanyStatus.APPROVED) {
      await this.companies.update(id, {
        status: CompanyStatus.APPROVED,
        rejectReason: null,
        approvedAt: new Date(),
      });
      // Công ty và các tin đã đăng của công ty vừa trở thành công khai.
      this.revalidate.notify(companyTags(id));
    }
    return toAdminCompany(await this.findById(id));
  }

  /**
   * Từ chối kèm lý do. Từ chối công ty đã duyệt cũng được (thu hồi duyệt): tin của công ty đó
   * thôi công khai vì isJobPublic đòi công ty APPROVED.
   */
  async reject(id: string, reason: string): Promise<AdminCompany> {
    const before = await this.findById(id);
    await this.companies.update(id, {
      status: CompanyStatus.REJECTED,
      rejectReason: reason,
      approvedAt: null,
    });
    // Thu hồi duyệt: trang công ty và mọi tin của công ty phải biến khỏi web ngay.
    if (before.status === CompanyStatus.APPROVED) this.revalidate.notify(companyTags(id));
    return toAdminCompany(await this.findById(id));
  }

  private async findById(id: string): Promise<Company> {
    const company = await this.companies.findOne({
      where: { id },
      relations: { translations: true, owner: true },
    });
    if (!company) throw new AppException(ErrorCode.NOT_FOUND);
    return company;
  }
}
