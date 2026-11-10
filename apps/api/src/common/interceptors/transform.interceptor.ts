import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { isPaginated, type ApiSuccess, type Paginated } from '@ltwnc/shared';
import { map, type Observable } from 'rxjs';

type Wrapped<T> = ApiSuccess<T> | Paginated<unknown> | StreamableFile;

/**
 * Bọc response thành công thành `{ data }`.
 * Kết quả đã có dạng `{ data, meta }` (phân trang) hoặc là file thì giữ nguyên. Route SSE (`@Sse`)
 * không bọc: mỗi giá trị là một sự kiện đã đúng định dạng.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Wrapped<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<Wrapped<T> | T> {
    if (this.reflector.get<boolean | undefined>(SSE_METADATA, context.getHandler())) {
      return next.handle();
    }
    return next.handle().pipe(
      map((result): Wrapped<T> => {
        if (result instanceof StreamableFile || isPaginated(result)) return result;
        return { data: result };
      }),
    );
  }
}
