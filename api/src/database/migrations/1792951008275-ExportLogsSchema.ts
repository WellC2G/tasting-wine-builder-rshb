import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExportLogsSchema1792951008275 implements MigrationInterface {
  name = 'ExportLogsSchema1792951008275';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."export_external_status_enum" AS ENUM('MOCK_SUCCESS', 'WEBHOOK_SUCCESS', 'FAILED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "export_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "target_endpoint" character varying(500) NOT NULL,
        "mock_receipt_id" character varying(255),
        "valid_votes_count" integer NOT NULL,
        "rejected_outliers_count" integer NOT NULL,
        "payload_snapshot" jsonb NOT NULL,
        "external_status" "public"."export_external_status_enum" NOT NULL,
        "exported_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_export_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_export_logs_event_id" ON "export_logs" ("event_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "export_logs" ADD CONSTRAINT "fk_export_logs_event" FOREIGN KEY ("event_id") REFERENCES "tasting_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "export_logs" DROP CONSTRAINT "fk_export_logs_event"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_export_logs_event_id"`,
    );
    await queryRunner.query(`DROP TABLE "export_logs"`);
    await queryRunner.query(
      `DROP TYPE "public"."export_external_status_enum"`,
    );
  }
}
