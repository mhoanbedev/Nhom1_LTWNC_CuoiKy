import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanies1794211180396 implements MigrationInterface {
  name = 'CreateCompanies1794211180396';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "company_translations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "locale" "public"."locale" NOT NULL, "name" character varying(200) NOT NULL, "slug" character varying(120) NOT NULL, "description" text, "search_text" text NOT NULL, CONSTRAINT "PK_fbd53e64e0b67d91285d5603799" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_company_translations_locale_slug" ON "company_translations" ("locale", "slug") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_company_translations_company_locale" ON "company_translations" ("company_id", "locale") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."company_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."company_size" AS ENUM('1-10', '11-50', '51-200', '201-500', '500+')`,
    );
    await queryRunner.query(
      `CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "owner_id" uuid NOT NULL, "status" "public"."company_status" NOT NULL DEFAULT 'PENDING', "reject_reason" character varying(500), "logo_url" character varying(500), "logo_public_id" character varying(255), "website" character varying(255), "size" "public"."company_size", "industry_id" uuid, "location_id" uuid, "address" character varying(255), "approved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_companies_owner_id" ON "companies" ("owner_id") `,
    );
    await queryRunner.query(`CREATE INDEX "idx_companies_status" ON "companies" ("status") `);
    await queryRunner.query(
      `ALTER TABLE "company_translations" ADD CONSTRAINT "FK_a059146caf5f5cff593e17c9b0b" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" ADD CONSTRAINT "FK_df63e1563bbd91b428b5c50d8ad" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" ADD CONSTRAINT "FK_a9ea9f740765b888dbb4055bc9a" FOREIGN KEY ("industry_id") REFERENCES "industries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" ADD CONSTRAINT "FK_706b0088cd55b4428dd039f4298" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_7ae6334059289559722437bcc1c" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    // Viết tay: index trigram cho tìm kiếm không dấu (pg_trgm bật ở migration CreateExtensions).
    await queryRunner.query(
      `CREATE INDEX "idx_company_translations_search_trgm" ON "company_translations" USING gin ("search_text" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_company_translations_search_trgm"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_7ae6334059289559722437bcc1c"`);
    await queryRunner.query(
      `ALTER TABLE "companies" DROP CONSTRAINT "FK_706b0088cd55b4428dd039f4298"`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" DROP CONSTRAINT "FK_a9ea9f740765b888dbb4055bc9a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" DROP CONSTRAINT "FK_df63e1563bbd91b428b5c50d8ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_translations" DROP CONSTRAINT "FK_a059146caf5f5cff593e17c9b0b"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_companies_status"`);
    await queryRunner.query(`DROP INDEX "public"."uq_companies_owner_id"`);
    await queryRunner.query(`DROP TABLE "companies"`);
    await queryRunner.query(`DROP TYPE "public"."company_size"`);
    await queryRunner.query(`DROP TYPE "public"."company_status"`);
    await queryRunner.query(`DROP INDEX "public"."uq_company_translations_company_locale"`);
    await queryRunner.query(`DROP INDEX "public"."uq_company_translations_locale_slug"`);
    await queryRunner.query(`DROP TABLE "company_translations"`);
  }
}
