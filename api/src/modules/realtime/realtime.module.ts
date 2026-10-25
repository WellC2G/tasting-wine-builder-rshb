import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Participant } from '../auth/entities/participant.entity';
import { TastingRound } from '../events/entities/tasting-round.entity';
import { Rating } from '../ratings/entities/rating.entity';
import { ParticipantCounterService } from './participant-counter.service';
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
    TastingSessionPublisherService,
  ],
  exports: [
    ParticipantCounterService,
    TastingSessionPublisherService,
  ],
})
export class RealtimeModule {}
