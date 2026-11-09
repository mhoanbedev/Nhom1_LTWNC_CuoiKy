import type { Locale } from '@ltwnc/shared';

// Bổ sung trường do middleware của app gắn vào Request của Express.
declare global {
  namespace Express {
    interface Request {
      /** Gắn bởi requestIdMiddleware. */
      requestId?: string;
      /** Gắn bởi localeMiddleware. */
      locale?: Locale;
    }
  }
}

export {};
