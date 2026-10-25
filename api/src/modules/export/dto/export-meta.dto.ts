import { ApiProperty } from '@nestjs/swagger';

import { ExportExternalStatus } from '../enums/export-external-status.enum';

export class ExportMetaDto {
  @ApiProperty({ format: 'uuid' })
  exportLogId!: string;

  @ApiProperty({
    example: true,
    description: 'Признак имитационного приёмника',
  })
  simulationMode!: boolean;

  @ApiProperty({
    example:
      'http://localhost:4000/api/v1/mock/peoples-rating/batch',
  })
  targetEndpoint!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'pr_mock_98123_accepted',
  })
  mockReceiptId!: string | null;

  @ApiProperty({
    enum: ExportExternalStatus,
    enumName: 'ExportExternalStatus',
    example: ExportExternalStatus.MOCK_SUCCESS,
  })
  status!: ExportExternalStatus;

  @ApiProperty({ example: 16 })
  validVotesCount!: number;

  @ApiProperty({ example: 2 })
  rejectedOutliersCount!: number;
}
