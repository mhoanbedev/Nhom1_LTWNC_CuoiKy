import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthResponse, Locale } from '@ltwnc/shared';
import { Lang } from '../../common/decorators/lang.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiDataResponse, ApiErrorResponses } from '../../common/swagger/api-response.decorators';
import { AuthService } from './auth.service';
import { AuthResponseDto, LoginDto, RegisterCandidateDto } from './dto/auth.dto';

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
  ): Promise<AuthResponse> {
    return this.authService.registerCandidate(body, lang);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập bằng email và mật khẩu (Auth.js Credentials gọi)' })
  @ApiDataResponse(AuthResponseDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  login(@Body() body: LoginDto): Promise<AuthResponse> {
    return this.authService.login(body);
  }
}
