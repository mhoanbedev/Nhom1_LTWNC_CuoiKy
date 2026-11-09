import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiDataResponse, ApiErrorResponses } from '../../common/swagger/api-response.decorators';
import type { HealthResponse } from './dto/health-response.dto';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Kiểm tra API và kết nối database (Render health check)' })
  @ApiDataResponse(HealthResponseDto)
  @ApiErrorResponses(HttpStatus.SERVICE_UNAVAILABLE)
  check(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
