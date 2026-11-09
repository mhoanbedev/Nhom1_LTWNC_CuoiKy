import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMetaTables1794208436533 implements MigrationInterface {
  name = 'CreateMetaTables1794208436533';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "skills" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name_vi" character varying(100) NOT NULL, "name_en" character varying(100) NOT NULL, "slug" character varying(60) NOT NULL, CONSTRAINT "PK_0d3212120f4ecedf90864d7e298" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_skills_slug" ON "skills" ("slug") `);
    await queryRunner.query(
      `CREATE TABLE "industries" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name_vi" character varying(100) NOT NULL, "name_en" character varying(100) NOT NULL, "slug" character varying(60) NOT NULL, CONSTRAINT "PK_f1626dcb2d58142d7dfcca7b8d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_industries_slug" ON "industries" ("slug") `);
    await queryRunner.query(
      `CREATE TABLE "locations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name_vi" character varying(100) NOT NULL, "name_en" character varying(100) NOT NULL, "code" character varying(40) NOT NULL, CONSTRAINT "PK_7cc1c9e3853b94816c094825e74" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_locations_code" ON "locations" ("code") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_single_admin" ON "users" ("role") WHERE "role" = 'ADMIN'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_users_single_admin"`);
    await queryRunner.query(`DROP INDEX "public"."uq_locations_code"`);
    await queryRunner.query(`DROP TABLE "locations"`);
    await queryRunner.query(`DROP INDEX "public"."uq_industries_slug"`);
    await queryRunner.query(`DROP TABLE "industries"`);
    await queryRunner.query(`DROP INDEX "public"."uq_skills_slug"`);
    await queryRunner.query(`DROP TABLE "skills"`);
  }
}
