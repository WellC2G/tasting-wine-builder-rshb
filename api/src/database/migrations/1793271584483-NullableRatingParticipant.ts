import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableRatingParticipant1793271584483
  implements MigrationInterface
{
  name = 'NullableRatingParticipant1793271584483';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ratings" ALTER COLUMN "participant_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" DROP CONSTRAINT "fk_ratings_participant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" ADD CONSTRAINT "fk_ratings_participant" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ratings" DROP CONSTRAINT "fk_ratings_participant"`,
    );
    await queryRunner.query(
      `DELETE FROM "ratings" WHERE "participant_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" ALTER COLUMN "participant_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" ADD CONSTRAINT "fk_ratings_participant" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
