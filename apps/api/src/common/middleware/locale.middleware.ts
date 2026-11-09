import type { NextFunction, Request, Response } from 'express';
import { resolveLocale } from '../i18n/resolve-locale';

/** Gắn `req.locale` cho mọi request, kể cả request bị guard chặn hay route không tồn tại. */
export function localeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.locale = resolveLocale(req.query.lang, req.header('accept-language'));
  next();
}
