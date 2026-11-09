import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ErrorCode } from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const query = jest.fn<Promise<unknown>, [string]>();
  let service: HealthService;

  beforeEach(async () => {
    query.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: getDataSourceToken(), useValue: { query } }],
    }).compile();
    moduleRef.useLogger(false);
    service = moduleRef.get(HealthService);
  });

  it('trả ok khi database phản hồi', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);
    await expect(service.check()).resolves.toMatchObject({ status: 'ok', database: 'up' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('ném SERVICE_UNAVAILABLE (503) khi database lỗi', async () => {
    query.mockRejectedValue(new Error('ECONNREFUSED'));
    const error = await service.check().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    expect((error as AppException).getStatus()).toBe(503);
  });
});
