import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UploadedFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, type CompanyLogo, type RecruiterCompany } from '@ltwnc/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { IMAGE_MAX_MB, type UploadedFileLike } from '../../common/files/image-file';
import { SingleFileUpload } from '../../common/files/single-file-upload';
import { ApiDataResponse, ApiErrorResponses } from '../../common/swagger/api-response.decorators';
import type { RequestUser } from '../../common/types/request-user';
import { CompaniesService } from './companies.service';
import { CompanyInfoDto, CompanyLogoDto, RecruiterCompanyDto } from './dto/company.dto';

@ApiTags('Recruiter – Company')
@ApiBearerAuth()
@Roles(Role.RECRUITER)
@Controller('recruiter/company')
export class RecruiterCompanyController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'Công ty của nhà tuyển dụng đang đăng nhập (đủ bản vi và en)' })
  @ApiDataResponse(RecruiterCompanyDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  get(@CurrentUser() user: RequestUser): Promise<RecruiterCompany> {
    return this.companiesService.getForOwner(user.id);
  }

  @Put()
  @ApiOperation({
    summary: 'Sửa toàn bộ thông tin công ty',
    description:
      'Bản vi bắt buộc; bỏ en là xóa bản tiếng Anh. Công ty bị từ chối thì sửa xong tự về PENDING để admin duyệt lại.',
  })
  @ApiDataResponse(RecruiterCompanyDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  update(
    @CurrentUser() user: RequestUser,
    @Body() body: CompanyInfoDto,
  ): Promise<RecruiterCompany> {
    return this.companiesService.updateForOwner(user.id, body);
  }

  @Post('logo')
  @HttpCode(HttpStatus.OK)
  @SingleFileUpload(IMAGE_MAX_MB)
  @ApiOperation({
    summary: 'Đổi logo (JPG, PNG, WebP, tối đa 2 MB)',
    description: 'Logo công khai trên Cloudinary, thu nhỏ còn tối đa 512 px; logo cũ bị xóa.',
  })
  @ApiDataResponse(CompanyLogoDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.SERVICE_UNAVAILABLE,
  )
  uploadLogo(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: UploadedFileLike | undefined,
  ): Promise<CompanyLogo> {
    return this.companiesService.updateLogo(user.id, file);
  }
}
