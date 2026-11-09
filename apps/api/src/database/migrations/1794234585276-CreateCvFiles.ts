import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCvFiles1794234585276 implements MigrationInterface {
  name = 'CreateCvFiles1794234585276';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "cv_files" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "candidate_id" uuid NOT NULL, "original_name" character varying(255) NOT NULL, "cloudinary_public_id" character varying(255) NOT NULL, "size" integer NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_89bdf76e79a74acd27e46e1be82" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_cv_files_one_default" ON "cv_files" ("candidate_id") WHERE "is_default" AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_cv_files_candidate_id" ON "cv_files" ("candidate_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "cv_files" ADD CONSTRAINT "FK_adc4901b046b2389f3824db895a" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cv_files" DROP CONSTRAINT "FK_adc4901b046b2389f3824db895a"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_cv_files_candidate_id"`);
    await queryRunner.query(`DROP INDEX "public"."uq_cv_files_one_default"`);
    await queryRunner.query(`DROP TABLE "cv_files"`);
  }
}
