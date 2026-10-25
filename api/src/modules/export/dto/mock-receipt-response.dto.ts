import { ApiProperty } from '@nestjs/swagger';

export class MockReceiptResponseDto {
  @ApiProperty({
    example: 'pr_mock_98123_accepted',
    description: 'Квитанция имитационного приёмника',
  })
  receiptId!: string;

  @ApiProperty({ example: 'ACCEPTED_BY_MOCK' })
  status!: string;

  @ApiProperty({
    example: 3,
    description: 'Количество принятых образцов',
  })
  receivedSamplesCount!: number;

  @ApiProperty({
    format: 'date-time',
    example: '2026-10-25T14:30:00.000Z',
  })
  processedAt!: string;
}
