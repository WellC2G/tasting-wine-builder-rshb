import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { HealthResponseDto } from './dto/health-response.dto';

const SERVICE_NAME = 'tasting-constructor-api';
const SERVICE_VERSION = '0.1.0';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe used by Docker Compose' })
  @ApiOkResponse({ type: HealthResponseDto, description: 'API is alive' })
  check(): HealthResponseDto {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
    };
  }
}
