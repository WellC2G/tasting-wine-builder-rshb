import { ApiProperty } from '@nestjs/swagger';

import { ExportMetaDto } from './export-meta.dto';
import { ExportPayloadDto } from './export-payload.dto';

export class ExportResponseDto {
  @ApiProperty({ type: ExportMetaDto })
  exportMeta!: ExportMetaDto;

  @ApiProperty({ type: ExportPayloadDto })
  dispatchedPayload!: ExportPayloadDto;
}
