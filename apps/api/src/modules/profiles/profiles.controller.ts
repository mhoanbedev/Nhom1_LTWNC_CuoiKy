import { Body, Controller, Get, HttpStatus, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LOCALES, Role, type CandidateProfile, type Locale } from '@ltwnc/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Lang } from '../../common/decorators/lang.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiDataResponse, ApiErrorResponses } from '../../common/swagger/api-response.decorators';
import type { RequestUser } from '../../common/types/request-user';
import {
  BasicProfileDto,
  CandidateProfileDto,
  EducationStepDto,
  ProjectsStepDto,
  SkillsStepDto,
} from './dto/profile.dto';
import { ProfilesService } from './profiles.service';

const STEP_ERRORS = [HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN];

@ApiTags('Candidate – Profile')
@ApiBearerAuth()
@ApiQuery({ name: 'lang', enum: LOCALES, required: false, description: 'Ngôn ngữ tên kỹ năng' })
@Roles(Role.CANDIDATE)
@Controller('me/profile')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOperation({
    summary: 'Hồ sơ của ứng viên đang đăng nhập',
    description:
      'Chưa lưu bước nào thì trả hồ sơ rỗng. `completion.canApply` cho biết đã xong 3 bước bắt buộc (BASIC, EDUCATION, SKILLS) để nộp đơn chưa.',
  })
  @ApiDataResponse(CandidateProfileDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  get(@CurrentUser() user: RequestUser, @Lang() lang: Locale): Promise<CandidateProfile> {
    return this.profilesService.get(user.id, lang);
  }

  @Put('basic')
  @ApiOperation({ summary: 'Bước 1: thông tin cơ bản' })
  @ApiDataResponse(CandidateProfileDto)
  @ApiErrorResponses(...STEP_ERRORS)
  saveBasic(
    @CurrentUser() user: RequestUser,
    @Body() body: BasicProfileDto,
    @Lang() lang: Locale,
  ): Promise<CandidateProfile> {
    return this.profilesService.saveBasic(user.id, body, lang);
  }

  @Put('education')
  @ApiOperation({ summary: 'Bước 2: học vấn (gửi đủ danh sách, thay toàn bộ)' })
  @ApiDataResponse(CandidateProfileDto)
  @ApiErrorResponses(...STEP_ERRORS)
  saveEducation(
    @CurrentUser() user: RequestUser,
    @Body() body: EducationStepDto,
    @Lang() lang: Locale,
  ): Promise<CandidateProfile> {
    return this.profilesService.saveEducation(user.id, body, lang);
  }

  @Put('skills')
  @ApiOperation({ summary: 'Bước 3: kỹ năng và mức tự đánh giá 1-5 (thay toàn bộ)' })
  @ApiDataResponse(CandidateProfileDto)
  @ApiErrorResponses(...STEP_ERRORS)
  saveSkills(
    @CurrentUser() user: RequestUser,
    @Body() body: SkillsStepDto,
    @Lang() lang: Locale,
  ): Promise<CandidateProfile> {
    return this.profilesService.saveSkills(user.id, body, lang);
  }

  @Put('projects')
  @ApiOperation({
    summary: 'Bước 4: dự án (không bắt buộc; gửi mảng rỗng vẫn tính là xong bước)',
  })
  @ApiDataResponse(CandidateProfileDto)
  @ApiErrorResponses(...STEP_ERRORS)
  saveProjects(
    @CurrentUser() user: RequestUser,
    @Body() body: ProjectsStepDto,
    @Lang() lang: Locale,
  ): Promise<CandidateProfile> {
    return this.profilesService.saveProjects(user.id, body, lang);
  }
}
