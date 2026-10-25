import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { Wine } from '../modules/catalog/entities/wine.entity';
import { InitialCatalogSchema1730000000000 } from './migrations/1730000000000-InitialCatalogSchema';

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
    entities: [Wine],
    migrations: [InitialCatalogSchema1730000000000],
    migrationsRun: true,
    synchronize: false,
    uuidExtension: 'pgcrypto',
    retryAttempts: 10,
    retryDelay: 3000,
  };
}
