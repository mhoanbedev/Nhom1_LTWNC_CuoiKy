import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { isPaginated, type ApiSuccess, type Paginated } from '@ltwnc/shared';
import { map, type Observable } from 'rxjs';

type Wrapped<T> = ApiSuccess<T> | Paginated<unknown> | StreamableFile;

/**
 * Bọc response thành công thành `{ data }`.
 * Kết quả đã có dạng `{ data, meta }` (phân trang) hoặc là file thì giữ nguyên.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Wrapped<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<Wrapped<T>> {
    return next.handle().pipe(
      map((result): Wrapped<T> => {
        if (result instanceof StreamableFile || isPaginated(result)) return result;
        return { data: result };
      }),
    );
  }
}
