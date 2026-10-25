import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RUSSIAN_WINES } from '../data/russian-wines.data';
import { Wine } from '../entities/wine.entity';

export interface WineSeedResult {
  inserted: number;
  skipped: number;
}

@Injectable()
export class WineSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WineSeederService.name);

  constructor(
    @InjectRepository(Wine)
    private readonly winesRepository: Repository<Wine>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seed();
  }

  /**
   * Idempotently inserts the curated Russian wine catalog.
   * Existing external catalog ids are skipped, and ON CONFLICT DO NOTHING
   * protects against concurrent startup races.
   */
  async seed(): Promise<WineSeedResult> {
    try {
      const existingWines = await this.winesRepository.find({
        select: { externalCatalogId: true },
      });
      const existingIds = new Set(
        existingWines.map((wine) => wine.externalCatalogId),
      );
      const missingWines = RUSSIAN_WINES.filter(
        (wine) => !existingIds.has(wine.externalCatalogId),
      );

      if (missingWines.length === 0) {
        this.logger.log(
          `Wine catalog is up to date (${RUSSIAN_WINES.length} seed entries present)`,
        );
        return {
          inserted: 0,
          skipped: RUSSIAN_WINES.length,
        };
      }

      await this.winesRepository
        .createQueryBuilder()
        .insert()
        .into(Wine)
        .values(missingWines.map((wine) => ({ ...wine })))
        .orIgnore()
        .execute();

      this.logger.log(
        `Seeded ${missingWines.length} Russian wines ` +
          `(${existingIds.size} catalog rows already existed)`,
      );

      return {
        inserted: missingWines.length,
        skipped: RUSSIAN_WINES.length - missingWines.length,
      };
    } catch (error) {
      this.logger.error(
        'Failed to seed the Russian wine catalog',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
