import { ErrorCode } from '@ltwnc/shared';
import { OAuth2Client, type LoginTicket, type TokenPayload } from 'google-auth-library';
import { AppException } from '../../../common/exceptions/app.exception';
import { GoogleIdTokenVerifier } from './google-id-token.verifier';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';

const ticket = (payload: Partial<TokenPayload> | undefined): LoginTicket =>
  ({ getPayload: () => payload }) as unknown as LoginTicket;

async function expectAppError(promise: Promise<unknown>, code: ErrorCode): Promise<void> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppException);
  expect((error as AppException).code).toBe(code);
}

describe('GoogleIdTokenVerifier', () => {
  let verifier: GoogleIdTokenVerifier;
  let certs: jest.SpyInstance;
  let verify: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    certs = jest
      .spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync')
      .mockResolvedValue({ certs: {} } as never);
    verify = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken');
    verifier = new GoogleIdTokenVerifier({ clientId: CLIENT_ID });
  });

  it('verify với audience là GOOGLE_CLIENT_ID và chuẩn hoá thông tin', async () => {
    verify.mockResolvedValue(
      ticket({
        sub: '123',
        email: ' An@Gmail.COM ',
        email_verified: true,
        name: ' Nguyễn An ',
        picture: 'https://lh3.googleusercontent.com/a/anh',
      }),
    );
    await expect(verifier.verify('id-token')).resolves.toEqual({
      sub: '123',
      email: 'an@gmail.com',
      emailVerified: true,
      name: 'Nguyễn An',
      picture: 'https://lh3.googleusercontent.com/a/anh',
    });
    expect(verify).toHaveBeenCalledWith({ idToken: 'id-token', audience: CLIENT_ID });
  });

  it('thiếu email_verified thì coi như chưa xác minh', async () => {
    verify.mockResolvedValue(ticket({ sub: '123', email: 'an@gmail.com' }));
    await expect(verifier.verify('id-token')).resolves.toMatchObject({ emailVerified: false });
  });

  it('token sai (chữ ký, hạn, audience...) trả AUTH_GOOGLE_TOKEN_INVALID', async () => {
    verify.mockRejectedValue(new Error('Wrong recipient, payload audience != requiredAudience'));
    await expectAppError(verifier.verify('id-token'), ErrorCode.AUTH_GOOGLE_TOKEN_INVALID);
  });

  it('payload không có sub trả AUTH_GOOGLE_TOKEN_INVALID', async () => {
    verify.mockResolvedValue(ticket(undefined));
    await expectAppError(verifier.verify('id-token'), ErrorCode.AUTH_GOOGLE_TOKEN_INVALID);
  });

  it('không tải được khóa công khai của Google trả SERVICE_UNAVAILABLE', async () => {
    certs.mockRejectedValue(new Error('ECONNRESET'));
    await expectAppError(verifier.verify('id-token'), ErrorCode.SERVICE_UNAVAILABLE);
    expect(verify).not.toHaveBeenCalled();
  });
});
