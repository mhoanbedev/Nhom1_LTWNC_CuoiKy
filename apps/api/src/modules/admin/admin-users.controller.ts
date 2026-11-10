import { Controller, Get, HttpStatus, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, type AdminUser, type Paginated } from '@ltwnc/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../common/swagger/api-response.decorators';
import type { RequestUser } from '../../common/types/request-user';
import { AccountLockService } from '../auth/account-lock.service';
import { AdminUserDto, AdminUsersQueryDto } from '../users/dto/user.dto';
import { UsersService } from '../users/users.service';

@ApiTags('Admin – Users')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accountLockService: AccountLockService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách tài khoản, mới đăng ký lên trước',
    description: 'Lọc theo `role`, `status` và `q` (chuỗi con trong email hoặc tên).',
  })
  @ApiPaginatedResponse(AdminUserDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  list(@Query() query: AdminUsersQueryDto): Promise<Paginated<AdminUser>> {
    return this.usersService.listForAdmin(query);
  }

  @Patch(':id/lock')
  @ApiOperation({
    summary: 'Khóa tài khoản',
    description:
      'Mọi request có token của tài khoản đó trả 403 AUTH_ACCOUNT_LOCKED ngay, mọi phiên đăng nhập bị thu hồi. Không khóa được chính mình (400 CANNOT_LOCK_SELF). Khóa nhà tuyển dụng không ẩn tin của công ty.',
  })
  @ApiDataResponse(AdminUserDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  lock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: RequestUser,
  ): Promise<AdminUser> {
    return this.accountLockService.lock(admin.id, id);
  }

  @Patch(':id/unlock')
  @ApiOperation({ summary: 'Mở khóa tài khoản: đăng nhập lại được' })
  @ApiDataResponse(AdminUserDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  unlock(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUser> {
    return this.accountLockService.unlock(id);
  }
}
