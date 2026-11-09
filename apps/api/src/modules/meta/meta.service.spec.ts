import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Industry } from './entities/industry.entity';
import { Location } from './entities/location.entity';
import { Skill } from './entities/skill.entity';
import { MetaService } from './meta.service';

const location = (code: string, nameVi: string, nameEn: string): Location =>
  ({ id: `id-${code}`, code, nameVi, nameEn }) as Location;

describe('MetaService', () => {
  const skills = { find: jest.fn<Promise<Skill[]>, []>() };
  const industries = { find: jest.fn<Promise<Industry[]>, []>() };
  const locations = { find: jest.fn<Promise<Location[]>, []>() };
  let service: MetaService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        MetaService,
        { provide: getRepositoryToken(Skill), useValue: skills },
        { provide: getRepositoryToken(Industry), useValue: industries },
        { provide: getRepositoryToken(Location), useValue: locations },
      ],
    }).compile();
    service = moduleRef.get(MetaService);
  });

  it('trả tên theo locale và xếp đúng thứ tự tiếng Việt (Cà Mau trước Cao Bằng, Đ sau D)', async () => {
    locations.find.mockResolvedValue([
      location('dong-nai', 'Đồng Nai', 'Dong Nai'),
      location('cao-bang', 'Cao Bằng', 'Cao Bang'),
      location('ca-mau', 'Cà Mau', 'Ca Mau'),
      location('da-nang', 'Đà Nẵng', 'Da Nang'),
      location('gia-lai', 'Gia Lai', 'Gia Lai'),
    ]);
    const vi = await service.listLocations('vi');
    expect(vi.map((l) => l.name)).toEqual(['Cà Mau', 'Cao Bằng', 'Đà Nẵng', 'Đồng Nai', 'Gia Lai']);
    expect(vi[0]).toEqual({ id: 'id-ca-mau', code: 'ca-mau', name: 'Cà Mau' });
  });

  it('bản tiếng Anh trả nameEn', async () => {
    skills.find.mockResolvedValue([
      { id: 's1', slug: 'teamwork', nameVi: 'Làm việc nhóm', nameEn: 'Teamwork' } as Skill,
      { id: 's2', slug: 'english', nameVi: 'Tiếng Anh', nameEn: 'English' } as Skill,
    ]);
    await expect(service.listSkills('en')).resolves.toEqual([
      { id: 's2', slug: 'english', name: 'English' },
      { id: 's1', slug: 'teamwork', name: 'Teamwork' },
    ]);
  });

  it('ngành trả slug và tên theo locale', async () => {
    industries.find.mockResolvedValue([
      { id: 'i1', slug: 'retail', nameVi: 'Bán lẻ', nameEn: 'Retail' } as Industry,
    ]);
    await expect(service.listIndustries('vi')).resolves.toEqual([
      { id: 'i1', slug: 'retail', name: 'Bán lẻ' },
    ]);
  });
});
