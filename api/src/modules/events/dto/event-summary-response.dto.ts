import { ApiProperty } from '@nestjs/swagger';

import {
  ScaleType,
  TastingEvent,
  TastingEventStatus,
  TastingMode,
} from '../entities/tasting-event.entity';

export class EventSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  hostId!: string;

  @ApiProperty({ example: 'Слепая дегустация: Автохтоны России' })
  title!: string;

  @ApiProperty({ example: '482910' })
  sessionPin!: string;

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
    example: TastingEventStatus.DRAFT,
  })
  status!: TastingEventStatus;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-14T18:00:00.000Z',
  })
  scheduledAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ example: 3 })
  roundCount!: number;

  @ApiProperty({ example: 18 })
  participantCount!: number;

  @ApiProperty({ example: 15 })
  connectedParticipantCount!: number;

  static fromEntity(
    event: TastingEvent,
    roundCount: number,
    participantCount: number,
    connectedParticipantCount: number,
  ): EventSummaryResponseDto {
    return {
      id: event.id,
      hostId: event.hostId,
      title: event.title,
      sessionPin: event.sessionPin,
      mode: event.mode,
      scaleType: event.scaleType,
      status: event.status,
      scheduledAt: event.scheduledAt,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      roundCount,
      participantCount,
      connectedParticipantCount,
    };
  }
}
