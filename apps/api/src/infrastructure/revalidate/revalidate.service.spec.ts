import { RevalidateService } from './revalidate.service';

const config = { url: 'https://web.test/api/revalidate', secret: 's'.repeat(32) };

function makeService(overrides: Partial<typeof config> | { url: null; secret: null } = {}) {
  const service = new RevalidateService({ ...config, ...overrides });
  // Không chờ giữa các lần thử lại trong test.
  Object.assign(service, { retryDelaysMs: [0, 0] });
  return service;
}

describe('RevalidateService', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('POST đúng URL, kèm header bí mật và body { tags }', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await expect(makeService().send(['job:1', 'jobs:list'])).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(config.url);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'x-revalidate-secret': config.secret });
    expect(JSON.parse(init.body as string)).toEqual({ tags: ['job:1', 'jobs:list'] });
  });

  it('lỗi thì thử lại, tối đa 3 lần', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(makeService().send(['sitemap'])).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('thất bại cả 3 lần thì trả false, không ném lỗi', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(makeService().send(['sitemap'])).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('chưa đặt REVALIDATE_URL thì không gọi mạng', async () => {
    await expect(makeService({ url: null, secret: null }).send(['sitemap'])).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('notify bỏ tag trùng và không chờ kết quả', () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const service = makeService();
    const send = jest.spyOn(service, 'send');
    expect(service.notify(['jobs:list', 'jobs:list', 'sitemap'])).toBeUndefined();
    expect(send).toHaveBeenCalledWith(['jobs:list', 'sitemap']);
  });
});
