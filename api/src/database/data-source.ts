import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

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

// Support both `api/.env` and the repository-level `.env` when running the
// TypeORM CLI from the api directory. Existing values are never overwritten.
loadEnv();
loadEnv({ path: '../.env' });

const DEFAULT_POSTGRES_HOST = 'localhost';
const DEFAULT_POSTGRES_PORT = 5432;

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Environment variable ${name} is required to run TypeORM migrations`,
    );
  }

  return value;
}

const port = Number(process.env.POSTGRES_PORT ?? DEFAULT_POSTGRES_PORT);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('POSTGRES_PORT must be a valid TCP port');
}

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? DEFAULT_POSTGRES_HOST,
  port,
  username: requireEnv('POSTGRES_USER'),
  password: requireEnv('POSTGRES_PASSWORD'),
  database: requireEnv('POSTGRES_DB'),
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
  ],
  migrationsRun: false,
  synchronize: false,
  uuidExtension: 'pgcrypto',
});

export default AppDataSource;
