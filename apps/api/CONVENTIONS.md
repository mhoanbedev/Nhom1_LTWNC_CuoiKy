# Luật code backend (`apps/api`)

Bản đầy đủ cho người đọc. `CLAUDE.md` cùng thư mục là bản ngắn cho Claude CLI.
Đặc tả nghiệp vụ, API, mã lỗi: [docs/SPEC-BACKEND.md](../../docs/SPEC-BACKEND.md).

Mức độ: **Bắt buộc** là luật, review sẽ trả lại nếu sai. **Khuyến nghị** là nên làm, có lý do thì được lệch.

## 1. Stack và phiên bản

| Thành phần | Phiên bản | Ghi chú |
| --- | --- | --- |
| Node.js | 24 LTS | `.nvmrc`, `engine-strict` |
| Quản lý gói | npm workspaces | `npm install` chỉ chạy ở gốc repo |
| NestJS | 11 | `nestjs-zod` chưa hỗ trợ 12 |
| TypeScript | 5.9 | khớp bản Nest CLI 11 dùng; ts-jest chưa hỗ trợ 7 |
| TypeORM | 0.3 + `pg` | `typeorm-naming-strategies` chưa hỗ trợ 1.x |
| Validate | Zod 4 + `nestjs-zod` | schema dùng chung đặt ở `packages/shared` |
| i18n | `nestjs-i18n` | file dịch `src/i18n/<vi\|en>/*.json` |
| Test | Jest 30 + ts-jest + supertest | |

**Bắt buộc:** không thêm thư viện ngoài stack trong đặc tả khi chưa thống nhất. Cài vào đúng workspace: `npm install <gói> --workspace=@ltwnc/api`.

## 2. Cấu trúc thư mục

```text
src/
├── main.ts, app.module.ts, app.setup.ts   bootstrap; app.setup dùng chung cho main và test e2e
├── config/          env.schema.ts (Zod) + registerAs theo nhóm (app, database, ...)
├── database/        data-source(-options).ts, database.module.ts, migrations/, seeds/
├── common/          dùng chung mọi module
│   ├── decorators/  @Lang, @CurrentUser, @Roles, @Public
│   ├── entities/    AppBaseEntity
│   ├── exceptions/  AppException, ERROR_HTTP_STATUS
│   ├── filters/     AllExceptionsFilter
│   ├── guards/      JwtAuthGuard (xử lý cả @Public, @OptionalAuth), RolesGuard
│   ├── i18n/        resolveLocale, dịch lỗi Zod
│   ├── interceptors/ TransformInterceptor, LoggingInterceptor
│   ├── middleware/  requestId, locale
│   ├── pipes/       AppZodValidationPipe
│   ├── swagger/     @ApiDataResponse, @ApiErrorResponses, ApiErrorDto
│   └── types/
├── infrastructure/  tích hợp bên ngoài, mỗi thứ một module (cloudinary/, revalidate/, mail/)
├── i18n/            vi/*.json, en/*.json
└── modules/<tên>/   một thư mục cho mỗi module nghiệp vụ
```

Một module nghiệp vụ để file phẳng ở gốc thư mục module, chỉ tách thư mục con `entities/`, `dto/` (thêm `google/`, `strategies/`... khi một nhóm file đủ lớn). Không tạo thư mục rỗng.

```text
modules/applications/
├── applications.module.ts
├── candidate-applications.controller.ts     mỗi nhóm route một controller
├── recruiter-applications.controller.ts
├── applications.service.ts                  nghiệp vụ của ứng viên
├── recruiter-applications.service.ts        nghiệp vụ của nhà tuyển dụng
├── application-transition.service.ts        chuyển trạng thái dùng chung
├── application.mapper.ts                    entity → response
├── entities/
├── dto/
└── *.spec.ts                                test đặt cạnh file được test
```

**Bắt buộc:** thêm tính năng mới bằng một thư mục trong `modules/`. Module chỉ **ghi** vào bảng của chính nó; cần ghi bảng của module khác (vd tạo thông báo) thì gọi service mà module đó export, truyền `EntityManager` khi phải chung transaction. **Đọc** bảng của module khác bằng join/QueryBuilder thì được.

## 3. Phân lớp

| Lớp | Được làm | Không được làm |
| --- | --- | --- |
| Controller | Route, `@Roles`/`@Public`/`@OptionalAuth`, decorator Swagger; nhận DTO; gọi service | Chứa nghiệp vụ, inject repository hay `DataSource` |
| Service | Nghiệp vụ, transaction, kiểm quyền sở hữu, ném `AppException`, phát event sau commit; truy vấn DB qua `Repository<Entity>` của TypeORM (`@InjectRepository`), QueryBuilder hoặc `DataSource` | Biết `Request`/`Response` của HTTP |
| Entity (TypeORM, kiểu Data Mapper) | Khai báo bảng, cột, quan hệ, index | Chứa logic hay gọi DB |
| Mapper | Đổi entity thành response, chọn bản dịch theo locale | Trả entity thô ra ngoài |
| Domain thuần (`packages/shared/src/domain`) | Hàm không phụ thuộc framework: `canTransition`, `matchScore`, `isJobPublic` | Import NestJS hay TypeORM |

**Bắt buộc:**

- Controller không chứa nghiệp vụ; service không biết HTTP; không bao giờ trả entity thô.
- Dùng mẫu Data Mapper của TypeORM (entity không tự đọc/ghi, mọi truy cập qua `Repository<Entity>`) nhưng **không tách tầng repository riêng**. Đây là đánh đổi có chủ ý: ít file hơn, đổi lại service phụ thuộc trực tiếp vào API của TypeORM. Query dài (tìm kiếm, thống kê) viết trong hàm `private` của service, có comment giải thích; SQL thô chỉ dùng khi QueryBuilder không diễn đạt được (khóa `FOR UPDATE`, `UPDATE ... RETURNING`, `ON CONFLICT`) và luôn truyền tham số `$1`, không nối chuỗi.
- Kiểm quyền hai lớp: Guard theo vai trò (`JwtAuthGuard` global + `RolesGuard` với `@Roles`), rồi service kiểm quyền sở hữu bằng cách lọc theo `companyId`/`candidateId` lấy từ `@CurrentUser()` (truyền vào hàm service). Không có guard sở hữu riêng.
- Truy cập tài nguyên không phải của mình: tài nguyên công khai trả 403, tài nguyên riêng tư (đơn, CV) trả 404.

## 4. Đặt tên

- File kebab-case theo mẫu `<tên>.<loại>.ts`: `job.entity.ts`, `create-job.dto.ts`, `jobs.service.ts`, `roles.guard.ts`, `jobs.service.spec.ts`.
- Class PascalCase; biến, hàm camelCase; hằng số và giá trị enum UPPER_SNAKE_CASE.
- Bảng và cột DB snake_case, tự đổi qua `SnakeNamingStrategy`; tên bảng đặt tường minh, số nhiều: `@Entity('job_translations')`.
- Mỗi file một class. File vượt khoảng 300 dòng thì tách (**Khuyến nghị**).

## 5. TypeScript

**Bắt buộc:**

- `strict`, `noUncheckedIndexedAccess` đang bật; không tắt.
- Không `any`. Buộc phải dùng thì tắt rule trên đúng dòng đó kèm lý do:
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <lý do>`.
- Không dùng non-null assertion `!`; kiểm tra rồi ném lỗi rõ ràng thay vì khẳng định.
- Method public của service khai báo kiểu trả về.
- Enum, mã lỗi, kiểu response, schema dùng chung lấy từ `@ltwnc/shared`, không định nghĩa lại trong `apps/api`.
- Enum viết dạng object `as const` + union type (xem `packages/shared/src/enums`), không dùng `enum` của TypeScript.

## 6. Cấu hình và biến môi trường

**Bắt buộc:**

- Mọi biến khai trong `src/config/env.schema.ts`; thiếu hoặc sai thì app không khởi động.
- Đọc env qua `ConfigService` hoặc `@Inject(xxxConfig.KEY)`; không đọc `process.env` rải rác (ngoại lệ: `data-source.ts` cho TypeORM CLI).
- Thêm biến thì cập nhật cùng lúc: `env.schema.ts`, `.env.example`, `test/setup-env.ts` (nếu test cần), bảng biến trong `README.md`.
- Biến của dịch vụ ngoài (Cloudinary, Google, JWT...) chỉ thêm ở bước dùng đến.

## 7. Database và migration

**Bắt buộc:**

- Entity kế thừa `AppBaseEntity` (id uuid, `createdAt`, `updatedAt` kiểu `timestamptz`).
- `synchronize` luôn tắt. Mọi thay đổi schema đi qua migration:
  `make migration-generate name=TenMoTa` (từ entity) hoặc `make migration-create name=TenMoTa` (SQL tay).
- Đọc lại migration sinh ra trước khi commit; không sửa migration đã merge vào `main`, cần đổi thì tạo migration mới.
- Thao tác ghi nhiều bảng chạy trong `dataSource.transaction()`.
- Việc phụ sau khi ghi (revalidate, email) phát event và chỉ chạy sau khi transaction commit.
- Chặn trùng bằng ràng buộc unique trong DB, không chỉ bằng SELECT trước (filter tự đổi `23505` thành 409).
- Danh sách luôn phân trang (`skip`/`take` + `findAndCount`, tối đa 50); nạp quan hệ bằng `relations`/`leftJoinAndSelect`, không query trong vòng lặp (N+1).

## 8. Lỗi và i18n

**Bắt buộc:**

- Chỉ ném `AppException(code, params?, details?)` với mã có trong `ErrorCode` (`packages/shared/src/errors/error-codes.ts`). HTTP status suy ra từ mã, không truyền tay.
- Thêm mã lỗi mới thì thêm đủ 4 nơi: `ErrorCode`, `ERROR_HTTP_STATUS`, `src/i18n/vi/errors.json`, `src/i18n/en/errors.json`, rồi thêm dòng vào bảng mã lỗi của đặc tả. Test `errors-translation.spec.ts` báo đỏ nếu thiếu bản dịch.
- Câu báo có tham số dùng `{tên}`: `"Bạn đã có tối đa {max} CV"` + `new AppException(ErrorCode.CV_LIMIT_REACHED, { max: 5 })`.
- Không hardcode chuỗi người dùng nhìn thấy trong code; đặt vào file dịch.
- Không bắt lỗi rồi nuốt im lặng. Lỗi không lường trước để filter trả 500 và ghi log.
- Nội dung song ngữ lấy ngôn ngữ bằng `@Lang()`; không có bản dịch theo `lang` thì 404, không lấy bản ngôn ngữ khác thay.

## 9. API

**Bắt buộc:**

- Route, quyền và mã lỗi theo mục 2, 7, 8 của đặc tả. Prefix `/api/v1` đặt sẵn trong `app.setup.ts`.
- Mọi body, query, param có DTO tạo bằng `createZodDto(schema)`; query số dùng `z.coerce`. Schema dùng chung với frontend đặt trong `packages/shared`.
- Controller trả dữ liệu thô; `TransformInterceptor` tự bọc `{ data }`. Danh sách trả `Paginated<T>` (`{ data, meta }`).
- Mọi endpoint có decorator Swagger: `@ApiTags` (một tag mỗi module), `@ApiOperation`, `@ApiDataResponse(Dto)`, `@ApiErrorResponses(...)`, `@ApiBearerAuth()` khi cần đăng nhập.
- Đổi API đã bàn giao cho frontend thì ghi `CHANGELOG-API.md` và báo nhóm.

## 10. Bảo mật

**Bắt buộc:**

- Không log mật khẩu, token, secret, body request.
- Secret chỉ đọc từ env; không commit `.env` hay giá trị thật.
- Không lộ stack trace hay thông điệp lỗi gốc ra response.
- Tài khoản bị khóa, role: luôn đọc lại từ DB, không tin payload của token.

## 11. Test

**Bắt buộc:**

- Hàm thuần và service mới phải có `*.spec.ts` đặt cạnh file. Service test bằng mock repository (`getRepositoryToken(Entity)`); query phức tạp và quyền sở hữu được phủ thêm bằng e2e trên DB thật.
- Test e2e đặt trong `test/*.e2e-spec.ts`, dựng app bằng `configureApp(app)` giống `main.ts`; cần Postgres đang chạy (`make up`).
- Tên test viết tiếng Việt, mô tả hành vi: `it('trả 409 khi nộp trùng đơn')`.
- Mục tiêu: coverage từ 70% ở `packages/shared/src/domain` và các file `*.service.ts`.

## 12. Git

**Bắt buộc:**

- Mỗi bước trong mục 12 của đặc tả làm trên một nhánh `feat/api-<bước>`; mỗi việc nhỏ một commit; `make check` xanh rồi mới commit.
- **Mỗi dòng checklist đi đúng thứ tự, không gộp, không làm trước:**
  1. Gửi plan cụ thể của dòng đó (làm gì, endpoint, quy tắc, điểm cần chốt) và đợi Hoàn duyệt.
  2. Code theo plan đã duyệt, chạy `make check` và e2e.
  3. Báo cách test (Swagger, pgAdmin) và **để nguyên chưa commit**.
  4. Chỉ commit khi Hoàn đã test xong và nhắn "commit".
  5. Sau đó mới gửi plan dòng tiếp theo.
- **Push, mở pull request, merge chỉ làm khi Hoàn nhắn**, mỗi việc hỏi riêng một lần.
- Commit theo Conventional Commits, scope `api` hoặc `shared`, mô tả tiếng Việt: `feat(api): đăng ký ứng viên`, `fix(shared): ...`, `docs(api): ...`, `test(api): ...`, `chore(api): ...`.
- Xong bước (và Hoàn đồng ý) thì mở pull request vào `main`, merge bằng **merge commit** (không squash) để giữ lịch sử commit làm minh chứng đóng góp.
