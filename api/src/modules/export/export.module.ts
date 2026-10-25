import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { TastingEvent } from '../events/entities/tasting-event.entity';
import { RatingsModule } from '../ratings/ratings.module';
import { PeoplesRatingClientAdapter } from './adapters/peoples-rating-client.adapter';
import { ExportLog } from './entities/export-log.entity';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { PeoplesRatingMockController } from './mock/peoples-rating-mock.controller';

@Module({
  imports: [
    AuthModule,
    RatingsModule,
    TypeOrmModule.forFeature([ExportLog, TastingEvent]),
  ],
  controllers: [ExportController, PeoplesRatingMockController],
  providers: [
    ExportService,
    PeoplesRatingClientAdapter,
  ],
  exports: [ExportService],
})
export class ExportModule {}
