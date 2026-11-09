import { Controller, Get, Header, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CvDownload } from '@ltwnc/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiDataResponse, ApiErrorResponses } from '../../common/swagger/api-response.decorators';
import type { RequestUser } from '../../common/types/request-user';
import { CvsService } from './cvs.service';
import { CvDownloadDto } from './dto/cv.dto';

/** Tải file riêng tư. Không gắn @Roles: quyền kiểm theo từng file trong service. */
@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly cvsService: CvsService) {}

  @Get('cvs/:id')
  // Link chứa chữ ký, không cho trình duyệt hay proxy giữ lại.
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Lấy link tải CV (sống 60 giây)',
    description:
      'Ứng viên tải CV của mình; nhà tuyển dụng tải CV gắn với đơn vào tin của công ty mình. Còn lại (kể cả admin, CV đã xóa) trả 404 để không lộ CV có tồn tại.',
  })
  @ApiDataResponse(CvDownloadDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  downloadCv(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CvDownload> {
    return this.cvsService.download(user, id);
  }
}
