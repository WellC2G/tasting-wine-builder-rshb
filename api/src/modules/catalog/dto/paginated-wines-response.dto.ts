import { ApiProperty } from '@nestjs/swagger';

import { WineResponseDto } from './wine-response.dto';

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Current page (1-based)' })
  page!: number;

  @ApiProperty({ example: 20, description: 'Page size' })
  limit!: number;

  @ApiProperty({ example: 14, description: 'Total matching wines' })
  total!: number;

  @ApiProperty({ example: 1, description: 'Total number of pages' })
  totalPages!: number;
}

export class PaginatedWinesResponseDto {
  @ApiProperty({ type: [WineResponseDto] })
  data!: WineResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
