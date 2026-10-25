import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', description: 'Service liveness status' })
  status!: string;

  @ApiProperty({
    example: 'tasting-constructor-api',
    description: 'Service identifier',
  })
  service!: string;

  @ApiProperty({ example: '0.1.0', description: 'API version' })
  version!: string;

  @ApiProperty({
    example: 12.34,
    description: 'Node.js process uptime in seconds',
  })
  uptimeSeconds!: number;

  @ApiProperty({
    example: '2026-10-25T14:30:00.000Z',
    format: 'date-time',
    description: 'Response timestamp in ISO 8601 format',
  })
  timestamp!: string;
}
