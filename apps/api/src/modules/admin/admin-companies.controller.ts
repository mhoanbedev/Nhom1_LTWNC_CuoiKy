import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, type AdminCompany, type Paginated } from '@ltwnc/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../common/swagger/api-response.decorators';
import { CompaniesAdminService } from '../companies/companies-admin.service';
import {
  AdminCompaniesQueryDto,
  AdminCompanyDto,
  RejectCompanyDto,
} from '../companies/dto/company.dto';

@ApiTags('Admin – Companies')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/companies')
export class AdminCompaniesController {
  constructor(private readonly companiesAdminService: CompaniesAdminService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách công ty, mới đăng ký lên trước',
    description:
      'Lọc theo `status` (vd PENDING để xem công ty chờ duyệt) và `q` (tên, gõ không dấu được).',
  })
  @ApiPaginatedResponse(AdminCompanyDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  list(@Query() query: AdminCompaniesQueryDto): Promise<Paginated<AdminCompany>> {
    return this.companiesAdminService.list(query);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Duyệt công ty: công ty đăng được tin' })
  @ApiDataResponse(AdminCompanyDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  approve(@Param('id', ParseUUIDPipe) id: string): Promise<AdminCompany> {
    return this.companiesAdminService.approve(id);
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Từ chối công ty kèm lý do',
    description:
      'Nhà tuyển dụng thấy lý do, sửa công ty xong thì tự về PENDING. Từ chối công ty đã duyệt thì mọi tin của công ty thôi công khai.',
  })
  @ApiDataResponse(AdminCompanyDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectCompanyDto,
  ): Promise<AdminCompany> {
    return this.companiesAdminService.reject(id, body.reason);
  }
}
