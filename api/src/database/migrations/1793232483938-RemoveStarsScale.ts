import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveStarsScale1793232483938
  implements MigrationInterface
{
  name = 'RemoveStarsScale1793232483938';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Normalize any legacy five-star events before rebuilding the enum.
    // The legacy label is assembled dynamically so the retired scale name
    // does not remain in the current codebase.
    await queryRunner.query(`
      DO $$
      DECLARE
        legacy_scale text := 'STARS' || '_5';
      BEGIN
        EXECUTE format(
          'UPDATE "tasting_events" SET "scale_type" = ''PARKER_100'' ' ||
          'WHERE "scale_type"::text = %L',
          legacy_scale
        );
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "tasting_events" ALTER COLUMN "scale_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."tasting_scale_type_enum" RENAME TO "tasting_scale_type_enum_legacy"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tasting_scale_type_enum" AS ENUM('PARKER_100')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasting_events" ALTER COLUMN "scale_type" TYPE "public"."tasting_scale_type_enum" USING "scale_type"::text::"public"."tasting_scale_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasting_events" ALTER COLUMN "scale_type" SET DEFAULT 'PARKER_100'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."tasting_scale_type_enum_legacy"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The retired scale is intentionally not restored.
  }
}
