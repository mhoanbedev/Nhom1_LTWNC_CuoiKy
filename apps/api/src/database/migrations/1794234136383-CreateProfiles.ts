import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProfiles1794234136383 implements MigrationInterface {
  name = 'CreateProfiles1794234136383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "candidate_skills" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "profile_id" uuid NOT NULL, "skill_id" uuid NOT NULL, "level" smallint NOT NULL, CONSTRAINT "PK_e1bb466425868a6a6169ee0ee8f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_candidate_skills_skill_id" ON "candidate_skills" ("skill_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_candidate_skills_profile_skill" ON "candidate_skills" ("profile_id", "skill_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "profile_id" uuid NOT NULL, "name" character varying(200) NOT NULL, "role" character varying(100), "description" text, "tech_stack" character varying(50) array NOT NULL DEFAULT '{}', "url" character varying(500), "start_date" date, "end_date" date, CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_projects_profile_id" ON "projects" ("profile_id") `);
    await queryRunner.query(
      `CREATE TYPE "public"."profile_step" AS ENUM('BASIC', 'EDUCATION', 'SKILLS', 'PROJECTS')`,
    );
    await queryRunner.query(
      `CREATE TABLE "candidate_profiles" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "headline" character varying(150), "phone" character varying(20), "date_of_birth" date, "location_id" uuid, "about" text, "links" jsonb NOT NULL, "completed_steps" "public"."profile_step" array NOT NULL DEFAULT '{}', CONSTRAINT "PK_8e8cf5b54118601673585218cc4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_candidate_profiles_user_id" ON "candidate_profiles" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "educations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "profile_id" uuid NOT NULL, "school" character varying(200) NOT NULL, "major" character varying(200), "degree" character varying(100), "start_date" date NOT NULL, "end_date" date, "gpa" numeric(3,2), CONSTRAINT "PK_09d2f29e7f6f31f5c01d79d2dbf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_educations_profile_id" ON "educations" ("profile_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_skills" ADD CONSTRAINT "FK_05ff7dce5a9bc3d6971d0437dad" FOREIGN KEY ("profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_skills" ADD CONSTRAINT "FK_c84d2943849a7f0f8bec796572d" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_a1c80c1fb42dfbf1cac1dd51601" FOREIGN KEY ("profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD CONSTRAINT "FK_5a3673f11918bcea56f48549603" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD CONSTRAINT "FK_f18447da76dc0ccdc3d8ecf44d5" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "educations" ADD CONSTRAINT "FK_d158e89c3eb4fa5e31ab560119e" FOREIGN KEY ("profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "educations" DROP CONSTRAINT "FK_d158e89c3eb4fa5e31ab560119e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP CONSTRAINT "FK_f18447da76dc0ccdc3d8ecf44d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP CONSTRAINT "FK_5a3673f11918bcea56f48549603"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_a1c80c1fb42dfbf1cac1dd51601"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_skills" DROP CONSTRAINT "FK_c84d2943849a7f0f8bec796572d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_skills" DROP CONSTRAINT "FK_05ff7dce5a9bc3d6971d0437dad"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_educations_profile_id"`);
    await queryRunner.query(`DROP TABLE "educations"`);
    await queryRunner.query(`DROP INDEX "public"."uq_candidate_profiles_user_id"`);
    await queryRunner.query(`DROP TABLE "candidate_profiles"`);
    await queryRunner.query(`DROP TYPE "public"."profile_step"`);
    await queryRunner.query(`DROP INDEX "public"."idx_projects_profile_id"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP INDEX "public"."uq_candidate_skills_profile_skill"`);
    await queryRunner.query(`DROP INDEX "public"."idx_candidate_skills_skill_id"`);
    await queryRunner.query(`DROP TABLE "candidate_skills"`);
  }
}
