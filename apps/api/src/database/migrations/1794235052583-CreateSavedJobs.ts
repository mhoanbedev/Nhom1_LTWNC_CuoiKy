import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSavedJobs1794235052583 implements MigrationInterface {
  name = 'CreateSavedJobs1794235052583';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "saved_jobs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "candidate_id" uuid NOT NULL, "job_id" uuid NOT NULL, CONSTRAINT "PK_1e106c66fc89f96addc57f71fb0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_saved_jobs_job_id" ON "saved_jobs" ("job_id") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_saved_jobs_candidate_job" ON "saved_jobs" ("candidate_id", "job_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_jobs" ADD CONSTRAINT "FK_a3550195e29799042b9c8313c83" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_jobs" ADD CONSTRAINT "FK_af5c8a7f3e11e8e646ea0f81a04" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saved_jobs" DROP CONSTRAINT "FK_af5c8a7f3e11e8e646ea0f81a04"`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_jobs" DROP CONSTRAINT "FK_a3550195e29799042b9c8313c83"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_saved_jobs_candidate_job"`);
    await queryRunner.query(`DROP INDEX "public"."idx_saved_jobs_job_id"`);
    await queryRunner.query(`DROP TABLE "saved_jobs"`);
  }
}
