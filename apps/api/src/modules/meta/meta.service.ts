import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { IndustryItem, Locale, LocationItem, SkillItem } from '@ltwnc/shared';
import { Repository } from 'typeorm';
import { Industry } from './entities/industry.entity';
import { localizedName } from './entities/localized-name.entity';
import { Location } from './entities/location.entity';
import { Skill } from './entities/skill.entity';

/**
 * Sắp xếp theo tên ở tầng ứng dụng bằng Intl.Collator: collation của Postgres (nhất là bản
 * alpine) xếp "Đà Nẵng" sau "Yên Bái", sai thứ tự tiếng Việt.
 */
function sortByName<T extends { name: string }>(items: T[], locale: Locale): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  return items.sort((a, b) => collator.compare(a.name, b.name));
}

@Injectable()
export class MetaService {
  constructor(
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @InjectRepository(Industry) private readonly industries: Repository<Industry>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
  ) {}

  async listSkills(locale: Locale): Promise<SkillItem[]> {
    const rows = await this.skills.find();
    return sortByName(
      rows.map((row) => ({ id: row.id, slug: row.slug, name: localizedName(row, locale) })),
      locale,
    );
  }

  async listIndustries(locale: Locale): Promise<IndustryItem[]> {
    const rows = await this.industries.find();
    return sortByName(
      rows.map((row) => ({ id: row.id, slug: row.slug, name: localizedName(row, locale) })),
      locale,
    );
  }

  async listLocations(locale: Locale): Promise<LocationItem[]> {
    const rows = await this.locations.find();
    return sortByName(
      rows.map((row) => ({ id: row.id, code: row.code, name: localizedName(row, locale) })),
      locale,
    );
  }
}
