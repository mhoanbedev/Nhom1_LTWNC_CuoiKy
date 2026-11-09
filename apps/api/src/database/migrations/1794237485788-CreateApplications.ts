import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApplications1794237485788 implements MigrationInterface {
  name = 'CreateApplications1794237485788';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Hai bảng dùng chung kiểu enum application_status: TypeORM sinh CREATE/DROP TYPE hai lần, đã bỏ bản lặp.
    await queryRunner.query(
      `CREATE TYPE "public"."application_status" AS ENUM('SUBMITTED', 'REVIEWING', 'INTERVIEW', 'PASSED', 'FAILED', 'WITHDRAWN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "applications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "job_id" uuid NOT NULL, "candidate_id" uuid NOT NULL, "cv_file_id" uuid NOT NULL, "cover_letter" text, "status" "public"."application_status" NOT NULL DEFAULT 'SUBMITTED', "profile_snapshot" jsonb NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_938c0a27255637bde919591888f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_applications_candidate_id" ON "applications" ("candidate_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_applications_job_status" ON "applications" ("job_id", "status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_applications_job_candidate" ON "applications" ("job_id", "candidate_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "application_status_histories" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "application_id" uuid NOT NULL, "from_status" "public"."application_status", "to_status" "public"."application_status" NOT NULL, "changed_by_id" uuid, "note" character varying(500), CONSTRAINT "PK_d8d40f190bd5db5ad837384de59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_application_status_histories_application_id" ON "application_status_histories" ("application_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "FK_8aba14d7f098c23ba06d8693235" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "FK_b669b991b85b808f24b5734990a" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "FK_f5e35e42b92d94c3306fa5b71e3" FOREIGN KEY ("cv_file_id") REFERENCES "cv_files"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_status_histories" ADD CONSTRAINT "FK_3b47788338e9ad5f42f4f072db1" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_status_histories" ADD CONSTRAINT "FK_deded8adda0dbaccacd5c01a873" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "application_status_histories" DROP CONSTRAINT "FK_deded8adda0dbaccacd5c01a873"`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_status_histories" DROP CONSTRAINT "FK_3b47788338e9ad5f42f4f072db1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "FK_f5e35e42b92d94c3306fa5b71e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "FK_b669b991b85b808f24b5734990a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "FK_8aba14d7f098c23ba06d8693235"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_application_status_histories_application_id"`,
    );
    await queryRunner.query(`DROP TABLE "application_status_histories"`);
    await queryRunner.query(`DROP INDEX "public"."uq_applications_job_candidate"`);
    await queryRunner.query(`DROP INDEX "public"."idx_applications_job_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_applications_candidate_id"`);
    await queryRunner.query(`DROP TABLE "applications"`);
    await queryRunner.query(`DROP TYPE "public"."application_status"`);
  }
}
