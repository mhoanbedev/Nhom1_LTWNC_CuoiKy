import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ErrorCode } from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import {
  CloudinaryService,
  type UploadedImage,
} from '../../infrastructure/cloudinary/cloudinary.service';
import { RevalidateService } from '../../infrastructure/revalidate/revalidate.service';
import { CompaniesService } from './companies.service';
import { Company } from './entities/company.entity';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const png = { buffer: PNG, size: PNG.length };

describe('CompaniesService.updateLogo', () => {
  const companies = {
    findOneBy: jest.fn<Promise<Company | null>, [object]>(),
    update: jest.fn<Promise<unknown>, [string, Partial<Company>]>(),
  };
  const cloudinary = {
    uploadImage: jest.fn<Promise<UploadedImage>, [Buffer, object]>(),
    deleteImage: jest.fn<Promise<void>, [string]>(),
  };
  const revalidate = { notify: jest.fn<void, [string[]]>() };
  let service: CompaniesService;

  beforeEach(async () => {
    jest.resetAllMocks();
    cloudinary.uploadImage.mockResolvedValue({
      url: 'https://cdn/logo-moi.png',
      publicId: 'logos/moi',
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: getRepositoryToken(Company), useValue: companies },
        { provide: getDataSourceToken(), useValue: {} },
        { provide: CloudinaryService, useValue: cloudinary },
        { provide: RevalidateService, useValue: revalidate },
      ],
    }).compile();
    service = moduleRef.get(CompaniesService);
  });

  it('upload ảnh mới (512 px, folder logos), lưu rồi mới xóa logo cũ', async () => {
    companies.findOneBy.mockResolvedValue({ id: 'c1', logoPublicId: 'logos/cu' } as Company);
    await expect(service.updateLogo('hr-1', png)).resolves.toEqual({
      logoUrl: 'https://cdn/logo-moi.png',
    });
    expect(companies.findOneBy).toHaveBeenCalledWith({ ownerId: 'hr-1' });
    expect(cloudinary.uploadImage).toHaveBeenCalledWith(PNG, { folder: 'logos', maxSize: 512 });
    expect(companies.update).toHaveBeenCalledWith('c1', {
      logoUrl: 'https://cdn/logo-moi.png',
      logoPublicId: 'logos/moi',
    });
    expect(cloudinary.deleteImage).toHaveBeenCalledWith('logos/cu');
    expect(companies.update.mock.invocationCallOrder[0]).toBeLessThan(
      cloudinary.deleteImage.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('chưa có logo thì không xóa gì', async () => {
    companies.findOneBy.mockResolvedValue({ id: 'c1', logoPublicId: null } as Company);
    await service.updateLogo('hr-1', png);
    expect(cloudinary.deleteImage).not.toHaveBeenCalled();
  });

  it('lưu DB lỗi thì xóa ảnh vừa upload, giữ logo cũ', async () => {
    companies.findOneBy.mockResolvedValue({ id: 'c1', logoPublicId: 'logos/cu' } as Company);
    companies.update.mockRejectedValue(new Error('DB lỗi'));
    await expect(service.updateLogo('hr-1', png)).rejects.toThrow('DB lỗi');
    expect(cloudinary.deleteImage).toHaveBeenCalledTimes(1);
    expect(cloudinary.deleteImage).toHaveBeenCalledWith('logos/moi');
  });

  it('file không phải ảnh thì không gọi Cloudinary', async () => {
    const error = await service
      .updateLogo('hr-1', { buffer: Buffer.from('%PDF-1.4'), size: 8 })
      .catch((e: unknown) => e);
    expect((error as AppException).code).toBe(ErrorCode.FILE_INVALID_TYPE);
    expect(cloudinary.uploadImage).not.toHaveBeenCalled();
  });

  it('công ty đã duyệt đổi logo thì báo Next làm mới trang công ty; chưa duyệt thì không', async () => {
    companies.findOneBy.mockResolvedValue({
      id: 'c1',
      status: 'APPROVED',
      logoPublicId: null,
    } as Company);
    await service.updateLogo('hr-1', png);
    expect(revalidate.notify).toHaveBeenCalledWith([
      'company:c1',
      'companies:list',
      'jobs:list',
      'sitemap',
    ]);

    revalidate.notify.mockClear();
    companies.findOneBy.mockResolvedValue({
      id: 'c2',
      status: 'PENDING',
      logoPublicId: null,
    } as Company);
    await service.updateLogo('hr-2', png);
    expect(revalidate.notify).not.toHaveBeenCalled();
  });
});
