import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { Participant } from '../modules/auth/entities/participant.entity';
import { User } from '../modules/auth/entities/user.entity';
import { Wine } from '../modules/catalog/entities/wine.entity';
import { TastingEvent } from '../modules/events/entities/tasting-event.entity';
import { TastingRound } from '../modules/events/entities/tasting-round.entity';
import { InitialCatalogSchema1730000000000 } from './migrations/1730000000000-InitialCatalogSchema';
import { EventsAuthSchema1792945874561 } from './migrations/1792945874561-EventsAuthSchema';

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
    entities: [Wine, User, TastingEvent, TastingRound, Participant],
    migrations: [
      InitialCatalogSchema1730000000000,
      EventsAuthSchema1792945874561,
    ],
    migrationsRun: true,
    synchronize: false,
    uuidExtension: 'pgcrypto',
    retryAttempts: 10,
    retryDelay: 3000,
  };
}
