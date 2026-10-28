import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { Participant } from '../auth/entities/participant.entity';
import { TastingEvent } from '../events/entities/tasting-event.entity';
import { TastingRound } from '../events/entities/tasting-round.entity';
import { Rating } from '../ratings/entities/rating.entity';
import { RatingsModule } from '../ratings/ratings.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { LiveStateAccessGuard } from './guards/live-state-access.guard';
import { TastingSessionController } from './tasting-session.controller';
import { TastingSessionGateway } from './tasting-session.gateway';
import { TastingSessionService } from './tasting-session.service';
import { RoomStateService } from './room-state.service';

@Module({
  imports: [
    AuthModule,
    RealtimeModule,
    RatingsModule,
    TypeOrmModule.forFeature([
      TastingEvent,
      TastingRound,
      Participant,
      Rating,
    ]),
  ],
  controllers: [TastingSessionController],
  providers: [
    TastingSessionGateway,
    TastingSessionService,
    RoomStateService,
    LiveStateAccessGuard,
  ],
  exports: [TastingSessionService],
})
export class TastingSessionModule {}
