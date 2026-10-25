import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { Participant } from '../auth/entities/participant.entity';
import { TastingRound } from '../events/entities/tasting-round.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { Rating } from './entities/rating.entity';
import { GuestRatingGuard } from './guards/guest-rating.guard';
import { RoundStatsAccessGuard } from './guards/round-stats-access.guard';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { OutlierFilterService } from './services/outlier-filter.service';
import { ParkerScoreCalculator } from './services/parker-calculator.service';

@Module({
  imports: [
    AuthModule,
    RealtimeModule,
    TypeOrmModule.forFeature([
      Rating,
      TastingRound,
      Participant,
    ]),
  ],
  controllers: [RatingsController],
  providers: [
    RatingsService,
    ParkerScoreCalculator,
    OutlierFilterService,
    GuestRatingGuard,
    RoundStatsAccessGuard,
  ],
  exports: [OutlierFilterService],
})
export class RatingsModule {}
