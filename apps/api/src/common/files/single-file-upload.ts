import {
  applyDecorators,
  Injectable,
  PayloadTooLargeException,
  UseInterceptors,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { ErrorCode } from '@ltwnc/shared';
import type { Observable } from 'rxjs';
import { AppException } from '../exceptions/app.exception';

const MB = 1024 * 1024;

/**
 * Bọc FileInterceptor của Multer (memoryStorage: file nằm trong RAM, không ghi đĩa).
 * Multer dừng đọc ngay khi file vượt `limits.fileSize` và ném 413; ở đây đổi thành
 * 400 FILE_TOO_LARGE kèm `maxMb` để câu báo lỗi có số MB (mục 5.5 của đặc tả).
 */
function createLimitedFileInterceptor(maxMb: number) {
  const MulterInterceptor = FileInterceptor('file', { limits: { fileSize: maxMb * MB, files: 1 } });

  @Injectable()
  class LimitedFileInterceptor implements NestInterceptor {
    private readonly multer = new MulterInterceptor();

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
      try {
        return (await this.multer.intercept(context, next)) as Observable<unknown>;
      } catch (error) {
        if (error instanceof PayloadTooLargeException) {
          throw new AppException(ErrorCode.FILE_TOO_LARGE, { maxMb });
        }
        throw error;
      }
    }
  }
  return LimitedFileInterceptor;
}

/** Route nhận một file ở field `file` (multipart/form-data), tối đa `maxMb` MB. */
export function SingleFileUpload(maxMb: number) {
  return applyDecorators(
    UseInterceptors(createLimitedFileInterceptor(maxMb)),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: { file: { type: 'string', format: 'binary' } },
      },
    }),
  );
}
