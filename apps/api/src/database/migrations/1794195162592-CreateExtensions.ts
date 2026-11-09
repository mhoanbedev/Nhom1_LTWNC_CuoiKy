import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extension cần cho tìm kiếm (mục 3 của đặc tả):
 * - pg_trgm: index trigram cho tìm kiếm gần đúng trên cột searchText.
 * - unaccent: bỏ dấu tiếng Việt khi chuẩn hoá chuỗi tìm kiếm.
 * Tạo bằng migration để local và Neon giống nhau.
 */
export class CreateExtensions1794195162592 implements MigrationInterface {
  name = 'CreateExtensions1794195162592';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS unaccent');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS unaccent');
    await queryRunner.query('DROP EXTENSION IF EXISTS pg_trgm');
  }
}
