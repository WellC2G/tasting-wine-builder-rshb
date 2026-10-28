import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Participant } from '../auth/entities/participant.entity';
import { AuthModule } from '../auth/auth.module';
import { Wine } from '../catalog/entities/wine.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { TastingEvent } from './entities/tasting-event.entity';
import { TastingRound } from './entities/tasting-round.entity';
import { TastingSessionModule } from '../tasting-session/tasting-session.module';

@Module({
  imports: [
    AuthModule,
    TastingSessionModule,
    TypeOrmModule.forFeature([
      TastingEvent,
      TastingRound,
      Participant,
      Wine,
    ]),
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
