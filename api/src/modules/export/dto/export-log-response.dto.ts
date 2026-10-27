import { ApiProperty } from '@nestjs/swagger';

import { ExportLog } from '../entities/export-log.entity';
import { ExportExternalStatus } from '../enums/export-external-status.enum';
import { ExportPayloadDto } from './export-payload.dto';

export class ExportLogResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({
    example:
      'http://127.0.0.1:4000/api/v1/mock/peoples-rating/batch',
  })
  targetEndpoint!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'pr_mock_98123_accepted',
  })
  mockReceiptId!: string | null;

  @ApiProperty({ example: 16 })
  validVotesCount!: number;

  @ApiProperty({ example: 2 })
  rejectedOutliersCount!: number;

  @ApiProperty({
    type: ExportPayloadDto,
    description: 'Полный снимок отправленного JSON-пакета',
  })
  payloadSnapshot!: ExportPayloadDto;

  @ApiProperty({
    enum: ExportExternalStatus,
    enumName: 'ExportExternalStatus',
    example: ExportExternalStatus.MOCK_SUCCESS,
  })
  externalStatus!: ExportExternalStatus;

  @ApiProperty({ format: 'date-time' })
  exportedAt!: Date;

  static fromEntity(log: ExportLog): ExportLogResponseDto {
    return {
      id: log.id,
      eventId: log.eventId,
      targetEndpoint: log.targetEndpoint,
      mockReceiptId: log.mockReceiptId,
      validVotesCount: log.validVotesCount,
      rejectedOutliersCount: log.rejectedOutliersCount,
      payloadSnapshot: log.payloadSnapshot,
      externalStatus: log.externalStatus,
      exportedAt: log.exportedAt,
    };
  }
}
