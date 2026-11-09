import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OAuthProvider } from '@ltwnc/shared';
import { QueryFailedError } from 'typeorm';
import { AccountsService } from './accounts.service';
import { Account } from './entities/account.entity';

const uniqueViolation = (constraint: string): QueryFailedError<Error> =>
  new QueryFailedError<Error>(
    'INSERT',
    [],
    Object.assign(new Error('duplicate'), { code: '23505', constraint }),
  );

describe('AccountsService', () => {
  const repo = {
    findOneBy: jest.fn<Promise<Account | null>, [object]>(),
    insert: jest.fn<Promise<unknown>, [object]>(),
  };
  let service: AccountsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [AccountsService, { provide: getRepositoryToken(Account), useValue: repo }],
    }).compile();
    service = moduleRef.get(AccountsService);
  });

  it('findUserId trả userId của tài khoản đã liên kết, chưa có thì null', async () => {
    repo.findOneBy.mockResolvedValueOnce({ userId: 'user-1' } as Account);
    await expect(service.findUserId(OAuthProvider.GOOGLE, 'sub')).resolves.toBe('user-1');
    repo.findOneBy.mockResolvedValueOnce(null);
    await expect(service.findUserId(OAuthProvider.GOOGLE, 'sub')).resolves.toBeNull();
  });

  it('link bỏ qua lỗi trùng khi request khác vừa liên kết cùng tài khoản', async () => {
    repo.insert.mockRejectedValue(uniqueViolation('uq_accounts_provider_account'));
    await expect(service.link('user-1', OAuthProvider.GOOGLE, 'sub')).resolves.toBeUndefined();
  });

  it('link ném tiếp lỗi DB khác', async () => {
    repo.insert.mockRejectedValue(uniqueViolation('rang_buoc_khac'));
    await expect(service.link('user-1', OAuthProvider.GOOGLE, 'sub')).rejects.toBeInstanceOf(
      QueryFailedError,
    );
  });
});
