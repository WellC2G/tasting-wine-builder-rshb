import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Wine } from './entities/wine.entity';
import { WineSeederService } from './services/wine-seeder.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Wine])],
  controllers: [CatalogController],
  providers: [CatalogService, WineSeederService],
  exports: [CatalogService],
})
export class CatalogModule {}
