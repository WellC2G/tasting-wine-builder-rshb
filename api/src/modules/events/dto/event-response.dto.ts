import { ApiProperty } from '@nestjs/swagger';

import { TastingEvent } from '../entities/tasting-event.entity';
import { EventRoundResponseDto } from './event-round-response.dto';
import { EventSummaryResponseDto } from './event-summary-response.dto';

export class EventResponseDto extends EventSummaryResponseDto {
  @ApiProperty({
    type: [EventRoundResponseDto],
    description: 'Раунды дегустации с полными данными вин',
  })
  rounds!: EventRoundResponseDto[];

  static fromDetail(
    event: TastingEvent,
    participantCount: number,
    connectedParticipantCount: number,
  ): EventResponseDto {
    const summary = EventSummaryResponseDto.fromEntity(
      event,
      event.rounds.length,
      participantCount,
      connectedParticipantCount,
    );

    return {
      ...summary,
      rounds: [...event.rounds]
        .sort((left, right) => left.orderNumber - right.orderNumber)
        .map((round) =>
          EventRoundResponseDto.fromEntity(round, event.mode),
        ),
    };
  }
}
