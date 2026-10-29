import { MigrationInterface, QueryRunner } from 'typeorm';

export class SingleActiveEvent1793232864945
  implements MigrationInterface
{
  name = 'SingleActiveEvent1793232864945';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked_active_events AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
          ) AS "rank"
        FROM "tasting_events"
        WHERE "status" = 'ACTIVE'
      )
      UPDATE "tasting_events" AS event
      SET "status" = 'DRAFT'
      FROM ranked_active_events AS ranked
      WHERE event."id" = ranked."id"
        AND ranked."rank" > 1
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_tasting_events_single_active" ON "tasting_events" ((1)) WHERE "status" = 'ACTIVE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."uq_tasting_events_single_active"`,
    );
  }
}
