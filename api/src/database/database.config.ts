import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { Participant } from '../modules/auth/entities/participant.entity';
import { User } from '../modules/auth/entities/user.entity';
import { ExportLog } from '../modules/export/entities/export-log.entity';
import { Wine } from '../modules/catalog/entities/wine.entity';
import { TastingEvent } from '../modules/events/entities/tasting-event.entity';
import { TastingRound } from '../modules/events/entities/tasting-round.entity';
import { Rating } from '../modules/ratings/entities/rating.entity';
import { InitialCatalogSchema1730000000000 } from './migrations/1730000000000-InitialCatalogSchema';
import { EventsAuthSchema1792945874561 } from './migrations/1792945874561-EventsAuthSchema';
import { RatingsSchema1792950279937 } from './migrations/1792950279937-RatingsSchema';
import { ExportLogsSchema1792951008275 } from './migrations/1792951008275-ExportLogsSchema';
import { ParticipantNetworkIdentity1793140634953 } from './migrations/1793140634953-ParticipantNetworkIdentity';
import { WineCatalogUpdates1793226948059 } from './migrations/1793226948059-WineCatalogUpdates';
import { RemoveStarsScale1793232483938 } from './migrations/1793232483938-RemoveStarsScale';
import { SingleActiveEvent1793232864945 } from './migrations/1793232864945-SingleActiveEvent';
import { NullableRatingParticipant1793271584483 } from './migrations/1793271584483-NullableRatingParticipant';

const DEFAULT_POSTGRES_HOST = 'localhost';
const DEFAULT_POSTGRES_PORT = 5432;

/**
 * Builds TypeORM options from the shared POSTGRES_* environment variables.
 * Docker Compose overrides the host and port to reach the `postgres` service.
 */
export function buildTypeOrmOptions(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const port = Number(
    configService.get<string>('POSTGRES_PORT') ?? DEFAULT_POSTGRES_PORT,
  );

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('POSTGRES_PORT must be a valid TCP port');
  }

  return {
    type: 'postgres',
    host:
      configService.get<string>('POSTGRES_HOST') ?? DEFAULT_POSTGRES_HOST,
    port,
    username: configService.getOrThrow<string>('POSTGRES_USER'),
    password: configService.getOrThrow<string>('POSTGRES_PASSWORD'),
    database: configService.getOrThrow<string>('POSTGRES_DB'),
    entities: [
      Wine,
      User,
      TastingEvent,
      TastingRound,
      Participant,
      Rating,
      ExportLog,
    ],
    migrations: [
      InitialCatalogSchema1730000000000,
      EventsAuthSchema1792945874561,
      RatingsSchema1792950279937,
      ExportLogsSchema1792951008275,
      ParticipantNetworkIdentity1793140634953,
      WineCatalogUpdates1793226948059,
      RemoveStarsScale1793232483938,
      SingleActiveEvent1793232864945,
      NullableRatingParticipant1793271584483,
    ],
    migrationsRun: true,
    synchronize: false,
    uuidExtension: 'pgcrypto',
    retryAttempts: 10,
    retryDelay: 3000,
  };
}
