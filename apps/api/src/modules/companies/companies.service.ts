import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  CompanyStatus,
  ErrorCode,
  normalizeSearchText,
  type CompanyInfoInput,
  type CompanyLogo,
  type CompanyTranslationInput,
  type Locale,
  type RecruiterCompany,
} from '@ltwnc/shared';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { assertImageFile, type UploadedFileLike } from '../../common/files/image-file';
import { uniqueSlug } from '../../common/utils/unique-slug';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { toRecruiterCompany } from './company.mapper';
import { CompanyTranslation } from './entities/company-translation.entity';
import { Company } from './entities/company.entity';

/** Logo lưu tối đa 512 px cạnh dài, đủ cho thẻ công ty và JSON-LD. */
const LOGO_MAX_SIZE = 512;
const SLUG_FALLBACK: Record<Locale, string> = { vi: 'cong-ty', en: 'company' };

type CompanyColumns = Pick<Company, 'website' | 'size' | 'industryId' | 'locationId' | 'address'>;

function toColumns(input: CompanyInfoInput): CompanyColumns {
  return {
    website: input.website ?? null,
    size: input.size ?? null,
    industryId: input.industryId ?? null,
    locationId: input.locationId ?? null,
    address: input.address ?? null,
  };
}

/**
 * Công ty phía nhà tuyển dụng (mục 5.1 của đặc tả). Mỗi nhà tuyển dụng một công ty, tìm theo ownerId,
 * nên không có chuyện sửa nhầm công ty người khác.
 */
@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /** Tạo công ty PENDING kèm bản dịch, trong transaction đăng ký nhà tuyển dụng. */
  async createForOwner(
    ownerId: string,
    input: CompanyInfoInput,
    manager: EntityManager,
  ): Promise<Company> {
    const repository = manager.getRepository(Company);
    const company = await repository.save(repository.create({ ownerId, ...toColumns(input) }));
    await this.saveTranslation(manager, company.id, 'vi', input.translations.vi);
    if (input.translations.en) {
      await this.saveTranslation(manager, company.id, 'en', input.translations.en);
    }
    return company;
  }

  async getForOwner(ownerId: string): Promise<RecruiterCompany> {
    return toRecruiterCompany(await this.findOwned(ownerId, this.dataSource.manager));
  }

  /**
   * Sửa toàn bộ thông tin. Công ty bị từ chối thì sửa xong tự gửi duyệt lại (về PENDING).
   * Bỏ `en` là xóa bản tiếng Anh; slug của bản dịch đã có giữ nguyên dù đổi tên.
   */
  async updateForOwner(ownerId: string, input: CompanyInfoInput): Promise<RecruiterCompany> {
    await this.dataSource.transaction(async (manager) => {
      const company = await this.findOwned(ownerId, manager);
      const resubmit =
        company.status === CompanyStatus.REJECTED
          ? { status: CompanyStatus.PENDING, rejectReason: null }
          : {};
      await manager.getRepository(Company).update(company.id, { ...toColumns(input), ...resubmit });

      const existing = (locale: Locale) => company.translations?.find((t) => t.locale === locale);
      await this.saveTranslation(manager, company.id, 'vi', input.translations.vi, existing('vi'));
      const en = existing('en');
      if (input.translations.en) {
        await this.saveTranslation(manager, company.id, 'en', input.translations.en, en);
      } else if (en) {
        await manager.getRepository(CompanyTranslation).delete(en.id);
      }
    });
    return this.getForOwner(ownerId);
  }

  /** Đổi logo: upload ảnh mới, lưu, rồi mới xóa ảnh cũ trên Cloudinary. */
  async updateLogo(ownerId: string, file: UploadedFileLike | undefined): Promise<CompanyLogo> {
    assertImageFile(file);
    const company = await this.companies.findOneBy({ ownerId });
    if (!company) throw new AppException(ErrorCode.NOT_FOUND);

    const uploaded = await this.cloudinary.uploadImage(file.buffer, {
      folder: 'logos',
      maxSize: LOGO_MAX_SIZE,
    });
    try {
      await this.companies.update(company.id, {
        logoUrl: uploaded.url,
        logoPublicId: uploaded.publicId,
      });
    } catch (error) {
      // Lưu DB lỗi thì dọn ảnh vừa upload, tránh ảnh mồ côi.
      await this.cloudinary.deleteImage(uploaded.publicId);
      throw error;
    }
    if (company.logoPublicId) await this.cloudinary.deleteImage(company.logoPublicId);
    return { logoUrl: uploaded.url };
  }

  private async findOwned(ownerId: string, manager: EntityManager): Promise<Company> {
    const company = await manager.getRepository(Company).findOne({
      where: { ownerId },
      relations: { translations: true },
    });
    if (!company) throw new AppException(ErrorCode.NOT_FOUND);
    return company;
  }

  /** Có bản dịch rồi thì cập nhật (giữ slug), chưa có thì tạo với slug mới không trùng. */
  private async saveTranslation(
    manager: EntityManager,
    companyId: string,
    locale: Locale,
    input: CompanyTranslationInput,
    existing?: CompanyTranslation,
  ): Promise<void> {
    const repository = manager.getRepository(CompanyTranslation);
    const fields = {
      name: input.name,
      description: input.description || null,
      searchText: normalizeSearchText(input.name),
    };
    if (existing) {
      await repository.update(existing.id, fields);
      return;
    }
    const slug = await uniqueSlug(input.name, SLUG_FALLBACK[locale], (candidate) =>
      repository.existsBy({ locale, slug: candidate }),
    );
    await repository.insert({ companyId, locale, slug, ...fields });
  }
}
