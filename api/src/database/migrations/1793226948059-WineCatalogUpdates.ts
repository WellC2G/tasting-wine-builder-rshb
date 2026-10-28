import { MigrationInterface, QueryRunner } from 'typeorm';

export class WineCatalogUpdates1793226948059
  implements MigrationInterface
{
  name = 'WineCatalogUpdates1793226948059';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."tasting_round_status_enum" ADD VALUE IF NOT EXISTS 'SKIPPED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "wines" ALTER COLUMN "image_url" TYPE text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wines" ALTER COLUMN "image_url" TYPE character varying(500)`,
    );
    // PostgreSQL does not support removing an enum value safely.
  }
}
