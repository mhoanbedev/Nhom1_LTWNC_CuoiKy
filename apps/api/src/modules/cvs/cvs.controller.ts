import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CV_MAX_MB, Role, type CvFile } from '@ltwnc/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { UploadedPdfLike } from '../../common/files/pdf-file';
import { SingleFileUpload } from '../../common/files/single-file-upload';
import { ApiDataResponse, ApiErrorResponses } from '../../common/swagger/api-response.decorators';
import type { RequestUser } from '../../common/types/request-user';
import { CvFileDto } from './dto/cv.dto';
import { CvsService } from './cvs.service';

const OWN_CV_ERRORS = [
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
];

@ApiTags('Candidate – CV')
@ApiBearerAuth()
@Roles(Role.CANDIDATE)
@Controller('me/cvs')
export class CvsController {
  constructor(private readonly cvsService: CvsService) {}

  @Get()
  @ApiOperation({ summary: 'CV của ứng viên (chưa xóa), mới upload lên trước' })
  @ApiDataResponse(CvFileDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  list(@CurrentUser() user: RequestUser): Promise<CvFile[]> {
    return this.cvsService.list(user.id);
  }

  @Post()
  @SingleFileUpload(CV_MAX_MB)
  @ApiOperation({
    summary: 'Upload CV (PDF, tối đa 5 MB, tối đa 5 CV)',
    description:
      'Kiểm MIME type, đuôi .pdf và nội dung file (%PDF-). CV đầu tiên tự thành mặc định. File lưu riêng tư, không có URL công khai; tải qua GET /files/cvs/:id.',
  })
  @ApiDataResponse(CvFileDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.SERVICE_UNAVAILABLE,
  )
  upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: UploadedPdfLike | undefined,
  ): Promise<CvFile> {
    return this.cvsService.upload(user.id, file);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Đặt CV mặc định (được chọn sẵn khi nộp đơn)' })
  @ApiDataResponse(CvFileDto)
  @ApiErrorResponses(...OWN_CV_ERRORS)
  setDefault(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CvFile> {
    return this.cvsService.setDefault(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa CV (xóa mềm)',
    description:
      'Đơn đã nộp kèm CV này vẫn giữ file. Xóa CV mặc định thì CV mới nhất còn lại thành mặc định.',
  })
  @ApiNoContentResponse()
  @ApiErrorResponses(...OWN_CV_ERRORS)
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.cvsService.remove(user.id, id);
  }
}
