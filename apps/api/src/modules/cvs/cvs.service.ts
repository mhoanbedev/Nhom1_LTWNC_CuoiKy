import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { CV_MAX_COUNT, ErrorCode, type CvFile as CvFileDto } from '@ltwnc/shared';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import {
  assertPdfFile,
  decodeOriginalName,
  type UploadedPdfLike,
} from '../../common/files/pdf-file';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { CvFile } from './entities/cv-file.entity';

export function toCvFileDto(cv: CvFile): CvFileDto {
  return {
    id: cv.id,
    originalName: cv.originalName,
    size: cv.size,
    isDefault: cv.isDefault,
    createdAt: cv.createdAt.toISOString(),
  };
}

/**
 * CV của ứng viên (mục 5.5 của đặc tả). Mọi thao tác lọc theo `candidateId` của người gọi:
 * CV người khác trả 404 như không tồn tại. Thao tác đổi số lượng hay CV mặc định khóa dòng user
 * của ứng viên, nên hai request cùng lúc chạy lần lượt (không vượt 5 CV, không mất CV mặc định).
 */
@Injectable()
export class CvsService {
  constructor(
    @InjectRepository(CvFile) private readonly cvs: Repository<CvFile>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /** CV chưa xóa, mới upload lên trước. */
  async list(candidateId: string): Promise<CvFileDto[]> {
    const rows = await this.cvs.find({
      where: { candidateId, deletedAt: IsNull() },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
    return rows.map(toCvFileDto);
  }

  /** Upload CV: kiểm PDF, giới hạn 5 CV, lưu file riêng tư; CV đầu tiên tự thành mặc định. */
  async upload(candidateId: string, file: UploadedPdfLike | undefined): Promise<CvFileDto> {
    assertPdfFile(file);
    // Kiểm sớm để khỏi upload file thừa; kiểm lại trong transaction để chặn request đồng thời.
    await this.assertBelowLimit(this.dataSource.manager, candidateId);

    const uploaded = await this.cloudinary.uploadPrivateFile(file.buffer, {
      folder: `cvs/${candidateId}`,
      fileName: `${randomUUID()}.pdf`,
    });
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        await lockCandidate(manager, candidateId);
        const count = await this.assertBelowLimit(manager, candidateId);
        const repository = manager.getRepository(CvFile);
        return repository.save(
          repository.create({
            candidateId,
            originalName: decodeOriginalName(file.originalname),
            cloudinaryPublicId: uploaded.publicId,
            size: file.size,
            isDefault: count === 0,
          }),
        );
      });
      return toCvFileDto(saved);
    } catch (error) {
      // Không lưu được vào DB thì dọn file vừa upload, tránh file mồ côi trên Cloudinary.
      await this.cloudinary.deletePrivateFile(uploaded.publicId);
      throw error;
    }
  }

  /** Đặt CV mặc định (CV được chọn sẵn khi nộp đơn). */
  async setDefault(candidateId: string, id: string): Promise<CvFileDto> {
    const updated = await this.dataSource.transaction(async (manager) => {
      await lockCandidate(manager, candidateId);
      const cv = await this.findActive(manager, candidateId, id);
      const repository = manager.getRepository(CvFile);
      // Bỏ mặc định cũ trước rồi mới đặt mới: index unique chỉ cho một CV mặc định.
      await repository.update({ candidateId, isDefault: true }, { isDefault: false });
      await repository.update(cv.id, { isDefault: true });
      return repository.findOneByOrFail({ id: cv.id });
    });
    return toCvFileDto(updated);
  }

  /**
   * Xóa mềm: file trên Cloudinary giữ lại vì đơn đã nộp vẫn cần. Xóa CV mặc định thì CV mới nhất
   * còn lại thành mặc định.
   */
  async remove(candidateId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await lockCandidate(manager, candidateId);
      const cv = await this.findActive(manager, candidateId, id);
      const repository = manager.getRepository(CvFile);
      await repository.update(cv.id, { deletedAt: new Date(), isDefault: false });
      if (!cv.isDefault) return;
      const newest = await repository.findOne({
        where: { candidateId, deletedAt: IsNull() },
        order: { createdAt: 'DESC', id: 'ASC' },
      });
      if (newest) await repository.update(newest.id, { isDefault: true });
    });
  }

  /** CV chưa xóa của chính ứng viên; không có thì 404 (không lộ CV người khác có tồn tại). */
  private async findActive(
    manager: EntityManager,
    candidateId: string,
    id: string,
  ): Promise<CvFile> {
    const cv = await manager
      .getRepository(CvFile)
      .findOneBy({ id, candidateId, deletedAt: IsNull() });
    if (!cv) throw new AppException(ErrorCode.NOT_FOUND);
    return cv;
  }

  /** Trả số CV đang có; đủ 5 thì 400 CV_LIMIT_REACHED (CV đã xóa mềm không tính). */
  private async assertBelowLimit(manager: EntityManager, candidateId: string): Promise<number> {
    const count = await manager.getRepository(CvFile).countBy({ candidateId, deletedAt: IsNull() });
    if (count >= CV_MAX_COUNT) {
      throw new AppException(ErrorCode.CV_LIMIT_REACHED, { max: CV_MAX_COUNT });
    }
    return count;
  }
}

/** Khóa dòng user của ứng viên đến hết transaction: các thao tác CV của cùng người chạy lần lượt. */
async function lockCandidate(manager: EntityManager, candidateId: string): Promise<void> {
  await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [candidateId]);
}
