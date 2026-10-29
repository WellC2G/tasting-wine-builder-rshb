import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Participant } from '../auth/entities/participant.entity';
import { TastingRound } from '../events/entities/tasting-round.entity';
import { Rating } from '../ratings/entities/rating.entity';
import { ParticipantCounterService } from './participant-counter.service';
import { ParticipantRosterService } from './participant-roster.service';
import { TastingSessionPublisherService } from './tasting-session-publisher.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Participant,
      TastingRound,
      Rating,
    ]),
  ],
  providers: [
    ParticipantCounterService,
    ParticipantRosterService,
    TastingSessionPublisherService,
  ],
  exports: [
    ParticipantCounterService,
    ParticipantRosterService,
    TastingSessionPublisherService,
  ],
})
export class RealtimeModule {}
