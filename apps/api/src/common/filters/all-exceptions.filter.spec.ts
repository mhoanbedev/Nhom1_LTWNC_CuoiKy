import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ErrorCode, type ApiError } from '@ltwnc/shared';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { AppException } from '../exceptions/app.exception';
import { AllExceptionsFilter, resolveError } from './all-exceptions.filter';

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
  const filter = new AllExceptionsFilter();

  function run(exception: unknown): { status: number; body: ApiError } {
    const json = jest.fn<void, [ApiError]>();
    const status = jest.fn<{ json: typeof json }, [number]>().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/api/v1/x', method: 'GET', requestId: 'req-1' }),
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

  it('lỗi 500 không lộ chi tiết lỗi gốc', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { body } = run(new Error('mật khẩu database sai'));
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('mật khẩu database sai');
  });
});
