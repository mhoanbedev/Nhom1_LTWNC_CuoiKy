import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthResponse, AuthUser, Locale } from '@ltwnc/shared';
import { ClientInfo, type RequestClientInfo } from '../../common/decorators/client-info.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Lang } from '../../common/decorators/lang.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiDataResponse, ApiErrorResponses } from '../../common/swagger/api-response.decorators';
import type { RequestUser } from '../../common/types/request-user';
import { AuthService } from './auth.service';
import {
  AuthResponseDto,
  AuthUserDto,
  ChangePasswordDto,
  GoogleLoginDto,
  LoginDto,
  RefreshTokenDto,
  RegisterCandidateDto,
  UpdateMeDto,
} from './dto/auth.dto';

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
  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập bằng Google (Auth.js gửi account.id_token)',
    description:
      'Đã liên kết thì đăng nhập; email Google đã xác minh trùng tài khoản có sẵn thì liên kết vào; chưa có thì tạo ứng viên mới. Response giống /auth/login.',
  })
  @ApiDataResponse(AuthResponseDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.SERVICE_UNAVAILABLE,
  )
  loginWithGoogle(
    @Body() body: GoogleLoginDto,
    @Lang() lang: Locale,
    @ClientInfo() client: RequestClientInfo,
  ): Promise<AuthResponse> {
    return this.authService.loginWithGoogle(body.idToken, lang, client);
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

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thông tin user đang đăng nhập (đọc mới từ DB)' })
  @ApiDataResponse(AuthUserDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  me(@CurrentUser() user: RequestUser): Promise<AuthUser> {
    return this.authService.me(user.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Đổi tên hoặc ngôn ngữ ưa thích',
    description:
      'Frontend gọi khi người dùng chuyển ngôn ngữ, để thông báo và email sau đó dùng đúng ngôn ngữ.',
  })
  @ApiDataResponse(AuthUserDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  updateMe(@CurrentUser() user: RequestUser, @Body() body: UpdateMeDto): Promise<AuthUser> {
    return this.authService.updateMe(user.id, body);
  }

  @Patch('me/password')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Đổi mật khẩu',
    description:
      'Mọi thiết bị khác bị đăng xuất (refresh token bị thu hồi, access token cũ hết hiệu lực ngay). Trả cặp token mới cho thiết bị đang dùng.',
  })
  @ApiDataResponse(AuthResponseDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body() body: ChangePasswordDto,
    @ClientInfo() client: RequestClientInfo,
  ): Promise<AuthResponse> {
    return this.authService.changePassword(user.id, body, client);
  }
}
