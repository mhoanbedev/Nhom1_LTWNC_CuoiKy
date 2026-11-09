import type { EntityManager } from 'typeorm';
import { Industry } from '../../modules/meta/entities/industry.entity';
import { Location } from '../../modules/meta/entities/location.entity';
import { Skill } from '../../modules/meta/entities/skill.entity';
import { INDUSTRIES } from './data/industries';
import { LOCATIONS } from './data/locations';
import { SKILLS } from './data/skills';

export interface CatalogSeedResult {
  skills: number;
  industries: number;
  locations: number;
}

/**
 * Ghi danh mục theo khoá ổn định (slug/code): có rồi thì cập nhật tên, chưa có thì thêm.
 * Không xóa rồi tạo lại, để id giữ nguyên khi tin tuyển, hồ sơ đã trỏ tới.
 * Mục bị bỏ khỏi file dữ liệu không tự xóa khỏi DB.
 */
export async function seedCatalogs(manager: EntityManager): Promise<CatalogSeedResult> {
  await manager.getRepository(Skill).upsert([...SKILLS], ['slug']);
  await manager.getRepository(Industry).upsert([...INDUSTRIES], ['slug']);
  await manager.getRepository(Location).upsert([...LOCATIONS], ['code']);
  return { skills: SKILLS.length, industries: INDUSTRIES.length, locations: LOCATIONS.length };
}
