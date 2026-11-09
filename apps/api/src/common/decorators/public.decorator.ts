import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Bỏ qua JwtAuthGuard global cho route (hoặc cả controller) công khai.
 * Mặc định mọi route đều cần đăng nhập, quên gắn thì bị chặn chứ không bị lộ.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
