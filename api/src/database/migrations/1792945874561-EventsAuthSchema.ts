import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventsAuthSchema1792945874561 implements MigrationInterface {
  name = 'EventsAuthSchema1792945874561';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_role_enum" AS ENUM('HOST', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tasting_mode_enum" AS ENUM('BLIND', 'OPEN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tasting_scale_type_enum" AS ENUM('PARKER_100')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tasting_event_status_enum" AS ENUM('DRAFT', 'ACTIVE', 'FINISHED', 'EXPORTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tasting_round_status_enum" AS ENUM('PENDING', 'ACTIVE', 'VOTING_CLOSED', 'REVEALED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "name" character varying(120) NOT NULL,
        "role" "public"."user_role_enum" NOT NULL DEFAULT 'HOST',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tasting_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "host_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "session_pin" character varying(6) NOT NULL,
        "mode" "public"."tasting_mode_enum" NOT NULL DEFAULT 'BLIND',
        "scale_type" "public"."tasting_scale_type_enum" NOT NULL DEFAULT 'PARKER_100',
        "status" "public"."tasting_event_status_enum" NOT NULL DEFAULT 'DRAFT',
        "scheduled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_tasting_events_session_pin" CHECK ("session_pin" ~ '^[0-9]{6}$'),
        CONSTRAINT "pk_tasting_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tasting_rounds" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "wine_id" uuid NOT NULL,
        "order_number" integer NOT NULL,
        "blind_label" character varying(100) NOT NULL,
        "status" "public"."tasting_round_status_enum" NOT NULL DEFAULT 'PENDING',
        "duration_seconds" integer NOT NULL DEFAULT 180,
        "started_at" timestamptz,
        "revealed_at" timestamptz,
        CONSTRAINT "chk_tasting_rounds_order_number" CHECK ("order_number" > 0),
        CONSTRAINT "chk_tasting_rounds_duration" CHECK ("duration_seconds" > 0),
        CONSTRAINT "pk_tasting_rounds" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "participants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "guest_session_token" character varying(255) NOT NULL,
        "fingerprint_hash" character varying(64) NOT NULL,
        "nickname" character varying(80) NOT NULL,
        "is_online" boolean NOT NULL DEFAULT true,
        "joined_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_participants" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasting_events_host_id" ON "tasting_events" ("host_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tasting_events_session_pin" ON "tasting_events" ("session_pin")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasting_rounds_event_id" ON "tasting_rounds" ("event_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tasting_rounds_event_order" ON "tasting_rounds" ("event_id", "order_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_participants_event_id" ON "participants" ("event_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_participants_guest_session_token" ON "participants" ("guest_session_token")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_participants_event_fingerprint" ON "participants" ("event_id", "fingerprint_hash")`,
    );

    await queryRunner.query(
      `ALTER TABLE "tasting_events" ADD CONSTRAINT "fk_tasting_events_host" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasting_rounds" ADD CONSTRAINT "fk_tasting_rounds_event" FOREIGN KEY ("event_id") REFERENCES "tasting_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasting_rounds" ADD CONSTRAINT "fk_tasting_rounds_wine" FOREIGN KEY ("wine_id") REFERENCES "wines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participants" ADD CONSTRAINT "fk_participants_event" FOREIGN KEY ("event_id") REFERENCES "tasting_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "participants" DROP CONSTRAINT "fk_participants_event"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasting_rounds" DROP CONSTRAINT "fk_tasting_rounds_wine"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasting_rounds" DROP CONSTRAINT "fk_tasting_rounds_event"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasting_events" DROP CONSTRAINT "fk_tasting_events_host"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."uq_participants_event_fingerprint"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_participants_guest_session_token"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_participants_event_id"`);
    await queryRunner.query(`DROP TABLE "participants"`);

    await queryRunner.query(
      `DROP INDEX "public"."uq_tasting_rounds_event_order"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_tasting_rounds_event_id"`);
    await queryRunner.query(`DROP TABLE "tasting_rounds"`);

    await queryRunner.query(
      `DROP INDEX "public"."uq_tasting_events_session_pin"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_tasting_events_host_id"`);
    await queryRunner.query(`DROP TABLE "tasting_events"`);

    await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);

    await queryRunner.query(`DROP TYPE "public"."tasting_round_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tasting_event_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tasting_scale_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tasting_mode_enum"`);
    await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
  }
}
