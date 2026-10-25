import { ApiProperty } from '@nestjs/swagger';

import { WineResponseDto } from '../../catalog/dto/wine-response.dto';
import {
  TastingRound,
  TastingRoundStatus,
} from '../entities/tasting-round.entity';

export class EventRoundResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 1 })
  orderNumber!: number;

  @ApiProperty({ example: 'Образец №1' })
  blindLabel!: string;

  @ApiProperty({
    enum: TastingRoundStatus,
    enumName: 'TastingRoundStatus',
    example: TastingRoundStatus.PENDING,
  })
  status!: TastingRoundStatus;

  @ApiProperty({ example: 180 })
  durationSeconds!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  startedAt!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  revealedAt!: Date | null;

  @ApiProperty({
    type: WineResponseDto,
    description: 'Полные данные вина. Доступны только организатору.',
  })
  wine!: WineResponseDto;

  static fromEntity(round: TastingRound): EventRoundResponseDto {
    return {
      id: round.id,
      orderNumber: round.orderNumber,
      blindLabel: round.blindLabel,
      status: round.status,
      durationSeconds: round.durationSeconds,
      startedAt: round.startedAt,
      revealedAt: round.revealedAt,
      wine: WineResponseDto.fromEntity(round.wine),
    };
  }
}
