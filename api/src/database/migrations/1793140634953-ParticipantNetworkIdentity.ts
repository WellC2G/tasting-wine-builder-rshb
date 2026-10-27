import { MigrationInterface, QueryRunner } from 'typeorm';

export class ParticipantNetworkIdentity1793140634953
  implements MigrationInterface
{
  name = 'ParticipantNetworkIdentity1793140634953';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "participants" ADD "client_ip" character varying(64) NOT NULL DEFAULT 'unknown'`,
    );
    await queryRunner.query(
      `ALTER TABLE "participants" ADD "device_id" character varying(128) NOT NULL DEFAULT 'legacy'`,
    );
    await queryRunner.query(
      `ALTER TABLE "participants" ADD "environment_hash" character varying(64) NOT NULL DEFAULT 'legacy'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_participants_event_client_ip" ON "participants" ("event_id", "client_ip")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_participants_event_device_id" ON "participants" ("event_id", "device_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_participants_event_device_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_participants_event_client_ip"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participants" DROP COLUMN "environment_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participants" DROP COLUMN "device_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participants" DROP COLUMN "client_ip"`,
    );
  }
}
