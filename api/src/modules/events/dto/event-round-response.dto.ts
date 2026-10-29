import { ApiProperty } from '@nestjs/swagger';

import { WineResponseDto } from '../../catalog/dto/wine-response.dto';
import {
  TastingMode,
} from '../entities/tasting-event.entity';
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
    example: false,
    description:
      'Раскрыто ли вино. В OPEN-режиме всегда true, в BLIND — после отдельного раскрытия.',
  })
  isWineRevealed!: boolean;

  @ApiProperty({
    type: WineResponseDto,
    description: 'Полные данные вина. Доступны только организатору.',
  })
  wine!: WineResponseDto;

  static fromEntity(
    round: TastingRound,
    mode: TastingMode,
  ): EventRoundResponseDto {
    return {
      id: round.id,
      orderNumber: round.orderNumber,
      blindLabel: round.blindLabel,
      status: round.status,
      durationSeconds: round.durationSeconds,
      startedAt: round.startedAt,
      revealedAt: round.revealedAt,
      isWineRevealed:
        mode === TastingMode.OPEN || round.revealedAt !== null,
      wine: WineResponseDto.fromEntity(round.wine),
    };
  }
}
