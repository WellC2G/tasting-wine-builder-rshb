import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { WineResponseDto } from '../../catalog/dto/wine-response.dto';
import {
  ScaleType,
  TastingMode,
} from '../../events/entities/tasting-event.entity';
import { TastingRoundStatus } from '../../events/entities/tasting-round.entity';

export class GuestCurrentRoundDto {
  @ApiProperty({ format: 'uuid' })
  roundId!: string;

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
    description: 'Оставшееся время раунда в секундах',
    example: 142,
  })
  remainingSeconds!: number;

  @ApiPropertyOptional({
    type: WineResponseDto,
    description:
      'Данные вина. Передаются только в открытом режиме (OPEN); в слепом режиме (BLIND) поле отсутствует.',
  })
  wine?: WineResponseDto;
}

export class GuestEventDto {
  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ example: 'Слепая дегустация: Автохтоны России' })
  title!: string;

  @ApiProperty({
    enum: TastingMode,
    enumName: 'TastingMode',
    example: TastingMode.BLIND,
  })
  mode!: TastingMode;

  @ApiProperty({
    enum: ScaleType,
    enumName: 'ScaleType',
    example: ScaleType.PARKER_100,
  })
  scaleType!: ScaleType;

  @ApiProperty({
    type: GuestCurrentRoundDto,
    nullable: true,
    description:
      'Текущий раунд. В слепом режиме не содержит wineId и метаданных вина.',
  })
  currentRound!: GuestCurrentRoundDto | null;
}

export class GuestJoinResponseDto {
  @ApiProperty({ format: 'uuid' })
  participantId!: string;

  @ApiProperty({
    description: 'Токен гостевой сессии для последующих запросов',
    example: 'gst_7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  guestSessionToken!: string;

  @ApiProperty({ type: GuestEventDto })
  event!: GuestEventDto;
}
