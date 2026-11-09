import { Column, Entity, Index } from 'typeorm';
import { LocalizedNameEntity } from './localized-name.entity';

@Entity('skills')
export class Skill extends LocalizedNameEntity {
  /** Khoá ổn định (vd `nestjs`), seed upsert theo cột này nên id không đổi khi chạy lại. */
  @Index('uq_skills_slug', { unique: true })
  @Column({ type: 'varchar', length: 60 })
  slug: string;
}
