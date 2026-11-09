import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../types/request-user';

export const OPTIONAL_AUTH_KEY = 'optionalAuth';

/**
 * Route công khai nhưng nhận diện người xem nếu có gửi token (vd chi tiết tin kèm `isSaved` cho
 * ứng viên). Không có token, token sai hay hết hạn đều coi như khách, không trả 401: trang công
 * khai không bao giờ hỏng vì token cũ. Dùng cùng `@ViewerUser()` để đọc user (có thể undefined).
 */
export const OptionalAuth = (): MethodDecorator & ClassDecorator =>
  SetMetadata(OPTIONAL_AUTH_KEY, true);

/** User đang xem nếu đã đăng nhập, không thì undefined. Chỉ dùng trên route @OptionalAuth(). */
export const ViewerUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestUser | undefined =>
    context.switchToHttp().getRequest<Request>().user as RequestUser | undefined,
);
