import { Column, Entity, Index } from 'typeorm';
import { LocalizedNameEntity } from './localized-name.entity';

@Entity('industries')
export class Industry extends LocalizedNameEntity {
  /** Khoá ổn định (vd `it-software`), seed upsert theo cột này. */
  @Index('uq_industries_slug', { unique: true })
  @Column({ type: 'varchar', length: 60 })
  slug: string;
}
