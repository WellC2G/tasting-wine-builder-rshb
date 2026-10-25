import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Participant } from '../auth/entities/participant.entity';
import { AuthModule } from '../auth/auth.module';
import { TastingEvent } from '../events/entities/tasting-event.entity';
import { TastingRound } from '../events/entities/tasting-round.entity';
import { LiveStateAccessGuard } from './guards/live-state-access.guard';
import { TastingSessionController } from './tasting-session.controller';
import { TastingSessionGateway } from './tasting-session.gateway';
import { TastingSessionService } from './tasting-session.service';
import { RoomStateService } from './room-state.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      TastingEvent,
      TastingRound,
      Participant,
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
