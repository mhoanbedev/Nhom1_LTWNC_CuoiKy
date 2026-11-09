import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApplicationNotes1794239328528 implements MigrationInterface {
  name = 'CreateApplicationNotes1794239328528';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "application_notes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "application_id" uuid NOT NULL, "author_id" uuid, "content" text NOT NULL, CONSTRAINT "PK_db708de5fa99541ad52a1f907de" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_application_notes_application_id" ON "application_notes" ("application_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "application_notes" ADD CONSTRAINT "FK_1a5375c61bc031bba625c02096d" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_notes" ADD CONSTRAINT "FK_06841db9526c0d17f97cdc46551" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "application_notes" DROP CONSTRAINT "FK_06841db9526c0d17f97cdc46551"`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_notes" DROP CONSTRAINT "FK_1a5375c61bc031bba625c02096d"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_application_notes_application_id"`);
    await queryRunner.query(`DROP TABLE "application_notes"`);
  }
}
