import { applyDecorators, HttpStatus, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiErrorDto } from './api-error.dto';

/**
 * Mô tả response thành công trên Swagger đúng như TransformInterceptor trả: `{ data: <model> }`.
 *
 * @example @ApiDataResponse(HealthResponseDto)
 */
export function ApiDataResponse<T>(
  model: Type<T>,
  options: { status?: HttpStatus; description?: string; isArray?: boolean } = {},
): MethodDecorator & ClassDecorator {
  const item = { $ref: getSchemaPath(model) };
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: options.status ?? HttpStatus.OK,
      description: options.description,
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data: options.isArray ? { type: 'array', items: item } : item },
      },
    }),
  );
}

/**
 * Mô tả các response lỗi (format ApiError chung) của một endpoint.
 *
 * @example @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
 */
export function ApiErrorResponses(...statuses: HttpStatus[]): MethodDecorator & ClassDecorator {
  return applyDecorators(...statuses.map((status) => ApiResponse({ status, type: ApiErrorDto })));
}

/**
 * Mô tả response danh sách có phân trang: `{ data: <model>[], meta }`.
 *
 * @example @ApiPaginatedResponse(AdminCompanyDto)
 */
export function ApiPaginatedResponse<T>(model: Type<T>): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: HttpStatus.OK,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: {
            type: 'object',
            required: ['page', 'limit', 'total', 'totalPages'],
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              total: { type: 'integer', example: 42 },
              totalPages: { type: 'integer', example: 3 },
            },
          },
        },
      },
    }),
  );
}
