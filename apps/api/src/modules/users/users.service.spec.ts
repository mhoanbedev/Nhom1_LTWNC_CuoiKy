import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ErrorCode, Role } from '@ltwnc/shared';
import { QueryFailedError } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

const uniqueViolation = (constraint: string): QueryFailedError<Error> =>
  new QueryFailedError<Error>(
    'INSERT',
    [],
    Object.assign(new Error('duplicate'), { code: '23505', constraint }),
  );

describe('UsersService.createCandidate', () => {
  const repo = {
    create: jest.fn((data: Partial<User>) => data as User),
    save: jest.fn<Promise<User>, [User]>(),
  };
  let service: UsersService;
  const data = {
    email: 'an@example.com',
    name: 'An',
    passwordHash: 'hash',
    preferredLocale: 'vi' as const,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: repo }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('tạo user với role CANDIDATE', async () => {
    repo.save.mockImplementation((user) => Promise.resolve(user));
    await expect(service.createCandidate(data)).resolves.toMatchObject({
      email: 'an@example.com',
      role: Role.CANDIDATE,
    });
  });

  it('trùng email do đăng ký đồng thời trả AUTH_EMAIL_TAKEN', async () => {
    repo.save.mockRejectedValue(uniqueViolation('uq_users_email'));
    const error = await service.createCandidate(data).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).code).toBe(ErrorCode.AUTH_EMAIL_TAKEN);
  });

  it('lỗi DB khác được ném tiếp', async () => {
    repo.save.mockRejectedValue(uniqueViolation('uq_khac'));
    await expect(service.createCandidate(data)).rejects.toBeInstanceOf(QueryFailedError);
  });
});
