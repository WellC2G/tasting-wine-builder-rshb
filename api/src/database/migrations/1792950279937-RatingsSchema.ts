import { MigrationInterface, QueryRunner } from 'typeorm';

export class RatingsSchema1792950279937 implements MigrationInterface {
  name = 'RatingsSchema1792950279937';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."parker_quality_category_enum" AS ENUM('CLASSIC', 'OUTSTANDING', 'VERY_GOOD', 'GOOD', 'AVERAGE', 'UNACCEPTABLE')`,
    );
    await queryRunner.query(`
      CREATE TABLE "ratings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "round_id" uuid NOT NULL,
        "participant_id" uuid NOT NULL,
        "appearance_score" smallint,
        "aroma_score" smallint,
        "taste_score" smallint,
        "potential_score" smallint,
        "total_score" numeric(4,1) NOT NULL,
        "quality_category" "public"."parker_quality_category_enum" NOT NULL,
        "sweetness" smallint NOT NULL,
        "acidity" smallint NOT NULL,
        "tannins" smallint NOT NULL,
        "body" smallint NOT NULL,
        "aroma_intensity" smallint NOT NULL,
        "aroma_tags" jsonb NOT NULL,
        "personal_notes" text,
        "is_outlier" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_parker_subscores_bounds" CHECK (
          (appearance_score IS NULL OR (appearance_score BETWEEN 0 AND 5)) AND
          (aroma_score IS NULL OR (aroma_score BETWEEN 0 AND 15)) AND
          (taste_score IS NULL OR (taste_score BETWEEN 0 AND 20)) AND
          (potential_score IS NULL OR (potential_score BETWEEN 0 AND 10))
        ),
        CONSTRAINT "chk_organoleptics_bounds" CHECK (
          (sweetness BETWEEN 1 AND 10) AND
          (acidity BETWEEN 1 AND 10) AND
          (tannins BETWEEN 1 AND 10) AND
          (body BETWEEN 1 AND 10) AND
          (aroma_intensity BETWEEN 1 AND 10)
        ),
        CONSTRAINT "chk_total_score_bounds" CHECK ("total_score" BETWEEN 50.0 AND 100.0),
        CONSTRAINT "pk_ratings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_ratings_round_participant" ON "ratings" ("round_id", "participant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ratings_round_valid" ON "ratings" ("round_id") WHERE "is_outlier" = false`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" ADD CONSTRAINT "fk_ratings_round" FOREIGN KEY ("round_id") REFERENCES "tasting_rounds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" ADD CONSTRAINT "fk_ratings_participant" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ratings" DROP CONSTRAINT "fk_ratings_participant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" DROP CONSTRAINT "fk_ratings_round"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_ratings_round_participant"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_ratings_round_valid"`,
    );
    await queryRunner.query(`DROP TABLE "ratings"`);
    await queryRunner.query(
      `DROP TYPE "public"."parker_quality_category_enum"`,
    );
  }
}
