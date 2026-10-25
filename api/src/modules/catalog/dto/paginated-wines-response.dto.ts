import { ApiProperty } from '@nestjs/swagger';

import { WineResponseDto } from './wine-response.dto';

export class PaginationMetaDto {
  @ApiProperty({
    example: 1,
    description: 'Текущая страница, начиная с 1',
  })
  page!: number;

  @ApiProperty({ example: 20, description: 'Количество записей на странице' })
  limit!: number;

  @ApiProperty({
    example: 14,
    description: 'Общее количество найденных вин',
  })
  total!: number;

  @ApiProperty({
    example: 1,
    description: 'Общее количество страниц',
  })
  totalPages!: number;
}

export class PaginatedWinesResponseDto {
  @ApiProperty({ type: [WineResponseDto] })
  data!: WineResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
