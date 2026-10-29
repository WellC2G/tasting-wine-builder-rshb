import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { WineResponseDto } from '../../catalog/dto/wine-response.dto';
import {
  ScaleType,
  TastingEventStatus,
  TastingMode,
} from '../../events/entities/tasting-event.entity';
import { TastingRoundStatus } from '../../events/entities/tasting-round.entity';

export class LiveStateRoundDto {
  @ApiProperty({ format: 'uuid' })
  roundId!: string;

  @ApiProperty({ example: 1 })
  orderNumber!: number;

  @ApiProperty({ example: 'Образец №1' })
  blindLabel!: string;

  @ApiProperty({
    enum: TastingRoundStatus,
    enumName: 'TastingRoundStatus',
    example: TastingRoundStatus.ACTIVE,
  })
  status!: TastingRoundStatus;

  @ApiProperty({ example: 180 })
  durationSeconds!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-14T18:00:00.000Z',
  })
  startedAt!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-14T18:03:00.000Z',
  })
  endsAt!: Date | null;

  @ApiProperty({
    example: 142,
    description: 'Оставшееся время раунда в секундах',
  })
  remainingSeconds!: number;

  @ApiProperty({ example: false })
  isWineRevealed!: boolean;

  @ApiPropertyOptional({
    type: WineResponseDto,
    description:
      'Данные вина. Гость получает их только в режиме OPEN или после раскрытия образца.',
  })
  wine?: WineResponseDto;
}

export class LiveStateResponseDto {
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
    enum: TastingEventStatus,
    enumName: 'TastingEventStatus',
    example: TastingEventStatus.ACTIVE,
  })
  status!: TastingEventStatus;

  @ApiProperty({ example: 18 })
  participantCount!: number;

  @ApiProperty({ example: 15 })
  connectedParticipantCount!: number;

  @ApiProperty({
    type: LiveStateRoundDto,
    nullable: true,
    description: 'Текущий или последний управляемый раунд',
  })
  currentRound!: LiveStateRoundDto | null;
}
