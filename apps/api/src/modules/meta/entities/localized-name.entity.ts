import type { Locale } from '@ltwnc/shared';
import { Column } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';

/** Danh mục có tên hai ngôn ngữ; API chỉ trả một trường `name` theo locale. */
export abstract class LocalizedNameEntity extends AppBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  nameVi: string;

  @Column({ type: 'varchar', length: 100 })
  nameEn: string;
}

export function localizedName(entity: LocalizedNameEntity, locale: Locale): string {
  return locale === 'en' ? entity.nameEn : entity.nameVi;
}
