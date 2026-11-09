import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthResponse, Locale } from '@ltwnc/shared';
import { ClientInfo, type RequestClientInfo } from '../../common/decorators/client-info.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Lang } from '../../common/decorators/lang.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiDataResponse, ApiErrorResponses } from '../../common/swagger/api-response.decorators';
import type { RequestUser } from '../../common/types/request-user';
import { AuthService } from './auth.service';
import { AuthResponseDto, LoginDto, RefreshTokenDto, RegisterCandidateDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register/candidate')
  @ApiOperation({ summary: 'Đăng ký tài khoản ứng viên, trả token như đăng nhập' })
  @ApiDataResponse(AuthResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
  registerCandidate(
    @Body() body: RegisterCandidateDto,
    @Lang() lang: Locale,
    @ClientInfo() client: RequestClientInfo,
  ): Promise<AuthResponse> {
    return this.authService.registerCandidate(body, lang, client);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập bằng email và mật khẩu (Auth.js Credentials gọi)' })
  @ApiDataResponse(AuthResponseDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  login(@Body() body: LoginDto, @ClientInfo() client: RequestClientInfo): Promise<AuthResponse> {
    return this.authService.login(body, client);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đổi refresh token lấy cặp token mới (xoay vòng)',
    description:
      'Token cũ bị thu hồi. Gửi lại token đã thu hồi (ngoài 30 giây ân hạn) thì cả phiên bị thu hồi và trả 401 AUTH_REFRESH_REUSED.',
  })
  @ApiDataResponse(AuthResponseDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  refresh(
    @Body() body: RefreshTokenDto,
    @ClientInfo() client: RequestClientInfo,
  ): Promise<AuthResponse> {
    return this.authService.refresh(body.refreshToken, client);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất phiên hiện tại (thu hồi refresh token của phiên)' })
  @ApiNoContentResponse()
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  logout(@Body() body: RefreshTokenDto, @CurrentUser() user: RequestUser): Promise<void> {
    return this.authService.logout(body.refreshToken, user.id);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất mọi thiết bị (thu hồi mọi refresh token của user)' })
  @ApiNoContentResponse()
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  logoutAll(@CurrentUser() user: RequestUser): Promise<void> {
    return this.authService.logoutAll(user.id);
  }
}
