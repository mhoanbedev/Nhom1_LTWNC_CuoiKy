import { RequestMethod, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, SSE_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import type { UserRole } from '@ltwnc/shared';
import { OPTIONAL_AUTH_KEY } from '../../src/common/decorators/optional-auth.decorator';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';

export interface RouteInfo {
  method: string;
  /** Đường dẫn đầy đủ sau `/api/v1`, vd `/recruiter/jobs/:id`. */
  path: string;
  isPublic: boolean;
  optionalAuth: boolean;
  /** Vai trò được phép; rỗng = mọi user đã đăng nhập. */
  roles: UserRole[];
  sse: boolean;
}

const joinPath = (...parts: (string | undefined)[]) =>
  `/${parts
    .flatMap((part) => (part ?? '').split('/'))
    .filter(Boolean)
    .join('/')}`;

/** Đọc metadata của handler, nếu không có thì của controller (giống Reflector.getAllAndOverride). */
function metadataOf<T>(key: string, handler: object, controller: object): T | undefined {
  return (Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller)) as
    T | undefined;
}

/** Mọi route HTTP mà app đăng ký, kèm metadata phân quyền (đọc thẳng từ decorator). */
export function collectRoutes(app: INestApplication): RouteInfo[] {
  const routes: RouteInfo[] = [];
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as (new (...args: never[]) => object) | null;
      if (!controller) continue;
      const base = Reflect.getMetadata(PATH_METADATA, controller) as string | undefined;
      const prototype = controller.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(prototype)) {
        const handler = prototype[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (path === undefined || method === undefined) continue;
        routes.push({
          method: RequestMethod[method],
          path: joinPath(base, path),
          isPublic: metadataOf<boolean>(IS_PUBLIC_KEY, handler, controller) === true,
          optionalAuth: metadataOf<boolean>(OPTIONAL_AUTH_KEY, handler, controller) === true,
          roles: metadataOf<UserRole[]>(ROLES_KEY, handler, controller) ?? [],
          sse: Reflect.getMetadata(SSE_METADATA, handler) === true,
        });
      }
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
