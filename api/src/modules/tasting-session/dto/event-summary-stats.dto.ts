import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { WineResponseDto } from '../../catalog/dto/wine-response.dto';
import {
  TastingMode,
} from '../../events/entities/tasting-event.entity';
import { TastingRoundStatus } from '../../events/entities/tasting-round.entity';
import { ParkerQualityCategory } from '../../ratings/enums/parker-quality-category.enum';

export class SummaryRoundStatsDto {
  @ApiProperty({ example: 18 })
  totalRatings!: number;

  @ApiProperty({ example: 16 })
  validVotesCount!: number;

  @ApiProperty({ example: 2 })
  outliersRemovedCount!: number;

  @ApiProperty({ type: Number, nullable: true, example: 91.4 })
  meanScore!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 92 })
  medianScore!: number | null;

  @ApiProperty({
    enum: ParkerQualityCategory,
    enumName: 'ParkerQualityCategory',
    nullable: true,
    example: ParkerQualityCategory.OUTSTANDING,
  })
  qualityCategory!: ParkerQualityCategory | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Выдающиеся вина (Outstanding)',
  })
  qualityLabel!: string | null;
}

export class SummaryRoundItemDto {
  @ApiProperty({ format: 'uuid' })
  roundId!: string;

  @ApiProperty({ example: 1 })
  orderNumber!: number;

  @ApiProperty({ example: 'Образец №1' })
  blindLabel!: string;

  @ApiProperty({
    enum: TastingRoundStatus,
    enumName: 'TastingRoundStatus',
    example: TastingRoundStatus.REVEALED,
  })
  status!: TastingRoundStatus;

  @ApiProperty({ example: false })
  isWineRevealed!: boolean;

  @ApiPropertyOptional({
    type: WineResponseDto,
    nullable: true,
    description:
      'Данные вина. null, если BLIND-образец ещё не раскрыт.',
  })
  wine!: WineResponseDto | null;

  @ApiProperty({ type: SummaryRoundStatsDto })
  stats!: SummaryRoundStatsDto;
}

export class EventSummaryStatsDto {
  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({
    enum: TastingMode,
    enumName: 'TastingMode',
    example: TastingMode.BLIND,
  })
  mode!: TastingMode;

  @ApiProperty({ type: [SummaryRoundItemDto] })
  items!: SummaryRoundItemDto[];
}
