import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobs1794212551003 implements MigrationInterface {
  name = 'CreateJobs1794212551003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "job_skills" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "job_id" uuid NOT NULL, "skill_id" uuid NOT NULL, "is_required" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_79dc7f5be80bfe7a4e590a71041" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_job_skills_skill_id" ON "job_skills" ("skill_id") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_job_skills_job_skill" ON "job_skills" ("job_id", "skill_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "job_translations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "job_id" uuid NOT NULL, "locale" "public"."locale" NOT NULL, "title" character varying(200) NOT NULL, "slug" character varying(120) NOT NULL, "description" text, "requirements" text, "benefits" text, "search_text" text NOT NULL, CONSTRAINT "PK_03ea48d199069b7637e09faa2c3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_job_translations_locale_slug" ON "job_translations" ("locale", "slug") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_job_translations_job_locale" ON "job_translations" ("job_id", "locale") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."job_status" AS ENUM('DRAFT', 'PUBLISHED', 'CLOSED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."work_mode" AS ENUM('ONSITE', 'REMOTE', 'HYBRID')`,
    );
    await queryRunner.query(`CREATE TYPE "public"."currency" AS ENUM('VND', 'USD')`);
    await queryRunner.query(
      `CREATE TABLE "jobs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "short_id" character varying(12) NOT NULL, "company_id" uuid NOT NULL, "status" "public"."job_status" NOT NULL DEFAULT 'DRAFT', "is_hidden" boolean NOT NULL DEFAULT false, "hidden_reason" character varying(500), "work_mode" "public"."work_mode" NOT NULL DEFAULT 'ONSITE', "is_paid" boolean NOT NULL DEFAULT false, "salary_min" integer, "salary_max" integer, "currency" "public"."currency" NOT NULL DEFAULT 'VND', "location_id" uuid, "address" character varying(255), "quantity" smallint NOT NULL DEFAULT '1', "expires_at" TIMESTAMP WITH TIME ZONE, "published_at" TIMESTAMP WITH TIME ZONE, "closed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_jobs_short_id" ON "jobs" ("short_id") `);
    await queryRunner.query(`CREATE INDEX "idx_jobs_company_id" ON "jobs" ("company_id") `);
    await queryRunner.query(
      `CREATE INDEX "idx_jobs_status_hidden_expires" ON "jobs" ("status", "is_hidden", "expires_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "job_skills" ADD CONSTRAINT "FK_4f7427e13d249156f37669e7127" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_skills" ADD CONSTRAINT "FK_7c0a3c52e77f9d9d839fdbb14b6" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_translations" ADD CONSTRAINT "FK_f9ada7fa3973bb2809b6d215c00" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "FK_087a773c50525e348e26188e7cc" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "FK_1a8e5385d0c88b833461095c979" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    // Viết tay: index trigram cho tìm kiếm không dấu (pg_trgm bật ở migration CreateExtensions).
    await queryRunner.query(
      `CREATE INDEX "idx_job_translations_search_trgm" ON "job_translations" USING gin ("search_text" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_job_translations_search_trgm"`);
    await queryRunner.query(`ALTER TABLE "jobs" DROP CONSTRAINT "FK_1a8e5385d0c88b833461095c979"`);
    await queryRunner.query(`ALTER TABLE "jobs" DROP CONSTRAINT "FK_087a773c50525e348e26188e7cc"`);
    await queryRunner.query(
      `ALTER TABLE "job_translations" DROP CONSTRAINT "FK_f9ada7fa3973bb2809b6d215c00"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_skills" DROP CONSTRAINT "FK_7c0a3c52e77f9d9d839fdbb14b6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_skills" DROP CONSTRAINT "FK_4f7427e13d249156f37669e7127"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_jobs_status_hidden_expires"`);
    await queryRunner.query(`DROP INDEX "public"."idx_jobs_company_id"`);
    await queryRunner.query(`DROP INDEX "public"."uq_jobs_short_id"`);
    await queryRunner.query(`DROP TABLE "jobs"`);
    await queryRunner.query(`DROP TYPE "public"."currency"`);
    await queryRunner.query(`DROP TYPE "public"."work_mode"`);
    await queryRunner.query(`DROP TYPE "public"."job_status"`);
    await queryRunner.query(`DROP INDEX "public"."uq_job_translations_job_locale"`);
    await queryRunner.query(`DROP INDEX "public"."uq_job_translations_locale_slug"`);
    await queryRunner.query(`DROP TABLE "job_translations"`);
    await queryRunner.query(`DROP INDEX "public"."uq_job_skills_job_skill"`);
    await queryRunner.query(`DROP INDEX "public"."idx_job_skills_skill_id"`);
    await queryRunner.query(`DROP TABLE "job_skills"`);
  }
}
