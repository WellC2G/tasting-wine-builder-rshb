import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { Wine } from '../modules/catalog/entities/wine.entity';
import { InitialCatalogSchema1730000000000 } from './migrations/1730000000000-InitialCatalogSchema';

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
  entities: [Wine],
  migrations: [InitialCatalogSchema1730000000000],
  migrationsRun: false,
  synchronize: false,
  uuidExtension: 'pgcrypto',
});

export default AppDataSource;
