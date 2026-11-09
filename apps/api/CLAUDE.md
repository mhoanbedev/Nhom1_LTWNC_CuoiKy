# Backend NestJS (`apps/api`)

Đọc trước khi làm: [docs/SPEC-BACKEND.md](../../docs/SPEC-BACKEND.md) (đặc tả) và [CONVENTIONS.md](CONVENTIONS.md) (luật code đầy đủ).

## Phạm vi

- Chỉ sửa `apps/api` và `packages/shared`. Không động vào `apps/web`.
- Không cài thêm thư viện ngoài stack trong đặc tả khi chưa hỏi. Cài bằng `npm install <gói> --workspace=@ltwnc/api`, chạy ở gốc repo.
- Làm theo thứ tự checklist ở mục 12 của đặc tả; mỗi dòng checklist là một commit.

## Luật cốt lõi (chi tiết ở CONVENTIONS.md)

- Controller → Service → Repository/Mapper. Controller không có nghiệp vụ, service không biết HTTP, không trả entity thô.
- Lỗi: chỉ `throw new AppException(ErrorCode.X, params?)`. Mã mới thêm đủ: `ErrorCode` (shared), `ERROR_HTTP_STATUS`, `src/i18n/vi/errors.json`, `src/i18n/en/errors.json`.
- DTO: `createZodDto(schema)`; schema dùng chung với web đặt ở `packages/shared`.
- Swagger: `@ApiTags`, `@ApiOperation`, `@ApiDataResponse(Dto)`, `@ApiErrorResponses(...)` trên mọi endpoint.
- DB: entity kế thừa `AppBaseEntity`; đổi schema bằng migration, không bật `synchronize`; ghi nhiều bảng dùng transaction.
- Env: khai trong `src/config/env.schema.ts` + `.env.example`; đọc qua ConfigService.
- Kiểm quyền hai lớp: Guard + kiểm lại trong service.
- Không `any`, không `!`, không log mật khẩu/token.
- Hàm thuần và service mới có `*.spec.ts` đặt cạnh.

## Lệnh (chạy trong apps/api)

| Lệnh | Khi nào |
| --- | --- |
| `make up` | Bật Postgres (cổng 5435) trước khi chạy app hoặc test e2e |
| `make dev` | Chạy API ở `http://localhost:4000/api/v1`, Swagger `/api/docs` |
| `make migration-generate name=TenMoTa` | Sau khi sửa entity |
| `make migrate` | Chạy migration |
| `make check` | **Sau mỗi thay đổi**; sửa đến khi xanh (format, lint, typecheck, test) |
| `make test-e2e` | Khi đổi controller, guard, filter, pipe |
| `make format` | Khi `make check` báo lỗi định dạng |

Commit: Conventional Commits, scope `api` hoặc `shared`, mô tả tiếng Việt, mỗi commit một việc.
