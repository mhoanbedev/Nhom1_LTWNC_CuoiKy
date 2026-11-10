# @ltwnc/api – Backend NestJS

REST API cho cổng tuyển dụng thực tập. Đặc tả: [docs/SPEC-BACKEND.md](../../docs/SPEC-BACKEND.md).

## Chạy lần đầu

Cần Node.js 24, Docker Desktop đang chạy và `make` (trên Windows dùng Git Bash hoặc `choco install make`).

```bash
cd apps/api
make setup   # cài dependency, tạo .env, bật Postgres, chạy migration, seed, in thông số kết nối
make dev     # chạy API ở http://localhost:4000/api/v1
```

Không có `make` thì dùng npm tương ứng: `npm install` ở gốc, `node scripts/env.mjs`, `docker compose up -d --wait`, `npm run migration:run`, `npm run dev`.

## Lệnh make

Gõ `make` để xem đầy đủ.

| Lệnh | Việc làm |
| --- | --- |
| `make setup` | Lần đầu: cài dependency, tạo `.env`, bật Postgres, chạy migration, seed |
| `make env` | Tạo `.env` từ `.env.example` hoặc bổ sung biến còn thiếu |
| `make up` / `make down` | Bật / tắt Postgres và Mailpit (giữ dữ liệu) |
| `make logs` / `make ps` | Xem log / trạng thái container |
| `make db-shell` | Mở `psql` trong container |
| `make db-info` | In thông số kết nối Postgres cho pgAdmin trên máy |
| `make migrate` / `make migrate-revert` | Chạy / lùi migration |
| `make migration-show` | Liệt kê migration và trạng thái đã chạy |
| `make migration-generate name=AddJobIndex` | Sinh migration từ thay đổi entity |
| `make migration-create name=TenMoTa` | Tạo migration rỗng để viết SQL tay |
| `make cloudinary-check` | Thử key Cloudinary: upload một ảnh và một PDF riêng tư vào folder `dev-check/`, in link |
| `make mail-check` | Gửi một email thử qua SMTP trong `.env` (dev: xem ở Mailpit `http://localhost:8025`) |
| `make seed` | Seed danh mục (kỹ năng, ngành, tỉnh/thành) và tài khoản admin; chạy lại được nhiều lần |
| `make dev` | Chạy API ở chế độ watch |
| `make build` / `make start` | Build và chạy bản production trên máy |
| `make lint` / `make format` / `make typecheck` | Kiểm tra và định dạng code |
| `make test` / `make test-watch` / `make test-cov` / `make test-e2e` | Chạy test |
| `make check` | format + lint + typecheck + test; bắt buộc xanh trước khi push |

## Cổng dev

| Thành phần | Địa chỉ |
| --- | --- |
| API | `http://localhost:4000/api/v1` |
| Swagger UI | `http://localhost:4000/api/docs` (file: `/api/docs/openapi.json`) |
| Health check | `http://localhost:4000/api/v1/health` |
| PostgreSQL (Docker) | `localhost:5435` (5432–5434 đã có Postgres khác trên máy dùng) |
| Mailpit (Docker): xem email đã gửi | `http://localhost:8025` (SMTP `localhost:1025`) |

Tài khoản demo sau `make seed`:

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Admin (duy nhất) | `admin@demo.vn` | `Demo@2026` |

Xem dữ liệu bằng pgAdmin cài trên máy: Register → Server, tab Connection điền theo `make db-info` (host `localhost`, cổng `5435`, user/mật khẩu/database `ltwnc`).

## Webhook revalidate (cho nhóm frontend)

Khi dữ liệu công khai đổi (đăng, sửa, đóng tin; sửa công ty; admin duyệt...), backend gọi `POST REVALIDATE_URL` kèm header `x-revalidate-secret` và body `{ "tags": [...] }`. Tên tag và header lấy từ `RevalidateTag`, `REVALIDATE_SECRET_HEADER` trong `@ltwnc/shared`.

- **Dev:** mỗi người tự chạy backend trên máy mình nên tự có secret riêng (`make env` sinh vào `apps/api/.env`). Muốn thử webhook: copy `REVALIDATE_SECRET` trong `apps/api/.env` **của chính mình** sang env của Next (`apps/web/.env.local`), rồi đặt `REVALIDATE_URL=http://localhost:3000/api/revalidate` trong `apps/api/.env`. Không cần xin secret của người khác.
- **Production:** dùng một secret mới, chỉ đặt ở biến môi trường Render (backend) và Vercel (frontend), cùng một giá trị; không gửi qua chat nhóm. Thiếu `REVALIDATE_URL` khi `NODE_ENV=production` thì API không khởi động.

## Biến môi trường

Khai trong [.env.example](.env.example). `make env` tạo `.env` và tự bổ sung biến mới; không commit `.env`.

| Biến | Mục đích |
| --- | --- |
| `NODE_ENV`, `PORT`, `FRONTEND_URL` | Môi trường, cổng API, domain frontend (CORS) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Postgres trong Docker |
| `DATABASE_URL` | Chuỗi kết nối app dùng |
| `JWT_ACCESS_SECRET` | Khóa ký access token, tối thiểu 32 ký tự; để trống thì `make env` tự sinh cho dev |
| `JWT_ACCESS_EXPIRES_IN` | Thời hạn access token, vd `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | Thời hạn refresh token, vd `7d` |
| `REFRESH_TOKEN_GRACE_SECONDS` | Khoảng ân hạn khi xoay refresh token (giây), mặc định 30 |
| `RATE_LIMIT_AUTH_PER_MINUTE` | Số request/phút trên một IP cho đăng ký, đăng nhập, refresh, Google; mặc định 30 |
| `RATE_LIMIT_LOGIN_PER_EMAIL` | Số lần đăng nhập trong 15 phút cho một email (chặn dò mật khẩu); mặc định 10 |
| `GOOGLE_CLIENT_ID` | Client ID của OAuth client Google, dùng làm audience khi verify `id_token`; không phải bí mật |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Lưu ảnh (công khai) và CV (riêng tư). Kiểm key bằng `make cloudinary-check` |
| `REVALIDATE_URL`, `REVALIDATE_SECRET` | Webhook báo Next làm mới trang khi dữ liệu công khai đổi. URL để trống thì chỉ ghi log. Secret `make env` tự sinh; frontend dùng cùng giá trị để kiểm header `x-revalidate-secret` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Gửi email cho ứng viên khi đơn sang INTERVIEW, PASSED, FAILED. Dev dùng Mailpit (`localhost:1025`, không cần user/mật khẩu), xem tại `http://localhost:8025`. Gửi thật thì chỉ đổi các biến này (vd Gmail: `smtp.gmail.com`, `465`, `SMTP_SECURE=true`, App Password). `SMTP_HOST` trống thì tắt email, chỉ ghi log. `SMTP_PASS` là bí mật |
| `MAILPIT_UI_PORT` | Cổng giao diện Mailpit trong docker-compose (mặc định 8025) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Chỉ `make seed` dùng: tài khoản admin duy nhất. Chạy seed lại với giá trị khác thì cập nhật chính admin đó |
