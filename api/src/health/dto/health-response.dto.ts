import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    example: 'ok',
    description: 'Статус доступности сервиса',
  })
  status!: string;

  @ApiProperty({
    example: 'tasting-constructor-api',
    description: 'Идентификатор сервиса',
  })
  service!: string;

  @ApiProperty({ example: '0.1.0', description: 'Версия API' })
  version!: string;

  @ApiProperty({
    example: 12.34,
    description: 'Время работы процесса Node.js в секундах',
  })
  uptimeSeconds!: number;

  @ApiProperty({
    example: '2026-10-25T14:30:00.000Z',
    format: 'date-time',
    description: 'Время формирования ответа в формате ISO 8601',
  })
  timestamp!: string;
}
