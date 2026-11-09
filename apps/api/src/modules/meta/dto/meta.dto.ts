import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Chỉ để mô tả trên Swagger; kiểu thật nằm trong @ltwnc/shared (SkillItem, IndustryItem, LocationItem). */
const name = z.string().meta({ description: 'Tên theo ?lang (vi mặc định)' });

export class SkillItemDto extends createZodDto(
  z.object({ id: z.uuid(), slug: z.string().meta({ example: 'nestjs' }), name }),
) {}

export class IndustryItemDto extends createZodDto(
  z.object({ id: z.uuid(), slug: z.string().meta({ example: 'it-software' }), name }),
) {}

export class LocationItemDto extends createZodDto(
  z.object({ id: z.uuid(), code: z.string().meta({ example: 'ha-noi' }), name }),
) {}
