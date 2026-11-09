import type { Request, Response } from 'express';
import { requestIdMiddleware } from './request-id.middleware';

function run(headerValue?: string): { req: Request; setHeader: jest.Mock; next: jest.Mock } {
  const req = { header: () => headerValue } as unknown as Request;
  const setHeader = jest.fn();
  const next = jest.fn();
  requestIdMiddleware(req, { setHeader } as unknown as Response, next);
  return { req, setHeader, next };
}

describe('requestIdMiddleware', () => {
  it('dùng x-request-id gửi lên nếu hợp lệ', () => {
    const { req, setHeader, next } = run('abc-123');
    expect(req.requestId).toBe('abc-123');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'abc-123');
    expect(next).toHaveBeenCalled();
  });

  it('tự sinh uuid khi không có header', () => {
    const { req } = run();
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('bỏ header không hợp lệ để không ghi rác vào log', () => {
    const { req } = run('<script>alert(1)</script>');
    expect(req.requestId).not.toContain('<');
  });
});
