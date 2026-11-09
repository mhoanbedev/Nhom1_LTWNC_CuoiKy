import { Column, Entity, Index } from 'typeorm';
import { LocalizedNameEntity } from './localized-name.entity';

/** 34 tỉnh/thành sau sắp xếp đơn vị hành chính năm 2025. */
@Entity('locations')
export class Location extends LocalizedNameEntity {
  /** Khoá ổn định dạng không dấu (vd `ha-noi`), seed upsert theo cột này. */
  @Index('uq_locations_code', { unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;
}
