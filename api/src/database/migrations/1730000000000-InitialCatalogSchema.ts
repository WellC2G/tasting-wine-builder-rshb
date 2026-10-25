import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialCatalogSchema1730000000000 implements MigrationInterface {
  name = 'InitialCatalogSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(
      `CREATE TYPE "wine_type_enum" AS ENUM ('RED', 'WHITE', 'ROSE', 'SPARKLING', 'FORTIFIED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "wines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "external_catalog_id" varchar(120) NOT NULL,
        "name" varchar(255) NOT NULL,
        "winery" varchar(255) NOT NULL,
        "region" varchar(120) NOT NULL,
        "grape_varieties" varchar(255) NOT NULL,
        "vintage" integer NOT NULL,
        "wine_type" "wine_type_enum" NOT NULL,
        "retail_price" numeric(10,2) NOT NULL,
        "image_url" varchar(500),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_wines" PRIMARY KEY ("id"),
        CONSTRAINT "chk_wines_vintage" CHECK ("vintage" BETWEEN 1800 AND 2100),
        CONSTRAINT "chk_wines_retail_price" CHECK ("retail_price" >= 0)
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_wines_external_catalog_id" ON "wines" ("external_catalog_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_wines_wine_type" ON "wines" ("wine_type")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_wines_region" ON "wines" ("region")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_wines_vintage" ON "wines" ("vintage")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "wines"');
    await queryRunner.query('DROP TYPE "wine_type_enum"');
  }
}
