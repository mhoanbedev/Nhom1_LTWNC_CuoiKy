import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ErrorCode, type ApiError, type Locale } from '@ltwnc/shared';
import type { I18nService } from 'nestjs-i18n';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { z } from 'zod';
import en from '../../i18n/en/errors.json';
import vi from '../../i18n/vi/errors.json';
import { AppException, ValidationFailedException } from '../exceptions/app.exception';
import { AllExceptionsFilter, resolveError } from './all-exceptions.filter';

/** I18nService giả: đọc thẳng file dịch và điền {tham số}, đủ để kiểm tra filter. */
const fakeI18n = {
  t: (key: string, options?: { lang?: string; args?: Record<string, string | number> }) => {
    const files: Record<string, Record<string, string>> = { vi, en };
    const template = files[options?.lang ?? 'vi']?.[key.replace('errors.', '')] ?? key;
    return template.replace(/\{(\w+)\}/g, (m, k: string) => String(options?.args?.[k] ?? m));
  },
} as unknown as I18nService;

const queryFailed = (pgCode: string): QueryFailedError<Error> =>
  new QueryFailedError<Error>('INSERT ...', [], Object.assign(new Error('pg'), { code: pgCode }));

describe('resolveError', () => {
  it('AppException giữ mã, status, tham số và details', () => {
    const details = [{ field: 'email', message: 'bắt buộc' }];
    const result = resolveError(new AppException(ErrorCode.CV_LIMIT_REACHED, { max: 5 }, details));
    expect(result).toEqual({
      code: ErrorCode.CV_LIMIT_REACHED,
      status: HttpStatus.BAD_REQUEST,
      params: { max: 5 },
      details,
    });
  });

  it('status của AppException suy ra từ mã lỗi', () => {
    expect(resolveError(new AppException(ErrorCode.APPLICATION_DUPLICATE)).status).toBe(409);
    expect(resolveError(new AppException(ErrorCode.COMPANY_NOT_APPROVED)).status).toBe(403);
  });

  it('lỗi HTTP có sẵn của Nest quy về mã của dự án', () => {
    expect(resolveError(new NotFoundException())).toMatchObject({
      code: ErrorCode.NOT_FOUND,
      status: 404,
    });
    expect(resolveError(new BadRequestException())).toMatchObject({
      code: ErrorCode.BAD_REQUEST,
      status: 400,
    });
  });

  it('Postgres 23505 (trùng unique) thành 409 CONFLICT', () => {
    expect(resolveError(queryFailed('23505'))).toEqual({ code: ErrorCode.CONFLICT, status: 409 });
  });

  it('Postgres 23503 (vi phạm khóa ngoại) thành 400 INVALID_REFERENCE', () => {
    expect(resolveError(queryFailed('23503'))).toEqual({
      code: ErrorCode.INVALID_REFERENCE,
      status: 400,
    });
  });

  it('EntityNotFoundError thành 404', () => {
    expect(resolveError(new EntityNotFoundError('Job', {}))).toEqual({
      code: ErrorCode.NOT_FOUND,
      status: 404,
    });
  });

  it('lỗi không lường trước thành 500 INTERNAL_ERROR', () => {
    expect(resolveError(new Error('boom'))).toEqual({
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
    });
    expect(resolveError(queryFailed('42P01'))).toEqual({
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
    });
  });
});

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter(fakeI18n);

  function run(exception: unknown, locale?: Locale): { status: number; body: ApiError } {
    const json = jest.fn<void, [ApiError]>();
    const status = jest.fn<{ json: typeof json }, [number]>().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/api/v1/x', method: 'GET', requestId: 'req-1', locale }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;
    filter.catch(exception, host);
    const [statusCode] = status.mock.calls[0] ?? [];
    const [body] = json.mock.calls[0] ?? [];
    if (statusCode === undefined || body === undefined)
      throw new Error('Filter không gửi response');
    return { status: statusCode, body };
  }

  it('trả format lỗi thống nhất kèm câu báo đã điền tham số', () => {
    const { status, body } = run(new AppException(ErrorCode.CV_LIMIT_REACHED, { max: 5 }));
    expect(status).toBe(400);
    expect(body).toMatchObject({
      statusCode: 400,
      code: 'CV_LIMIT_REACHED',
      message: 'Bạn đã có tối đa 5 CV',
      details: null,
      path: '/api/v1/x',
      requestId: 'req-1',
    });
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('dịch câu báo theo ngôn ngữ của request', () => {
    const { body } = run(new AppException(ErrorCode.CV_LIMIT_REACHED, { max: 5 }), 'en');
    expect(body.message).toBe('You already have the maximum of 5 CVs');
  });

  it('lỗi validate trả details từng trường', () => {
    const parsed = z.object({ email: z.email() }).safeParse({ email: 'x' });
    if (parsed.success) throw new Error('Mong đợi lỗi validate');
    const { status, body } = run(new ValidationFailedException(parsed.error), 'en');
    expect(status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details).toEqual([{ field: 'email', message: expect.any(String) as string }]);
  });

  it('lỗi 500 không lộ chi tiết lỗi gốc', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { body } = run(new Error('mật khẩu database sai'));
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('mật khẩu database sai');
  });
});
