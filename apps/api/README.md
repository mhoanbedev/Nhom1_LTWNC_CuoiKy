# @ltwnc/api – Backend NestJS

REST API cho cổng tuyển dụng thực tập. Đặc tả: [docs/SPEC-BACKEND.md](../../docs/SPEC-BACKEND.md).

## Chạy lần đầu

Cần Node.js 24, Docker Desktop đang chạy và `make` (trên Windows dùng Git Bash hoặc `choco install make`).

```bash
cd apps/api
make setup   # cài dependency, tạo .env, bật Postgres, chạy migration, in thông số kết nối
make dev     # chạy API ở http://localhost:4000/api/v1
```

Không có `make` thì dùng npm tương ứng: `npm install` ở gốc, `node scripts/env.mjs`, `docker compose up -d --wait`, `npm run migration:run`, `npm run dev`.

## Lệnh make

Gõ `make` để xem đầy đủ.

| Lệnh | Việc làm |
| --- | --- |
| `make setup` | Lần đầu: cài dependency, tạo `.env`, bật Postgres, chạy migration |
| `make env` | Tạo `.env` từ `.env.example` hoặc bổ sung biến còn thiếu |
| `make up` / `make down` | Bật / tắt Postgres (giữ dữ liệu) |
| `make logs` / `make ps` | Xem log / trạng thái container |
| `make db-shell` | Mở `psql` trong container |
| `make db-info` | In thông số kết nối Postgres cho pgAdmin trên máy |
| `make migrate` / `make migrate-revert` | Chạy / lùi migration |
| `make migration-show` | Liệt kê migration và trạng thái đã chạy |
| `make migration-generate name=AddJobIndex` | Sinh migration từ thay đổi entity |
| `make migration-create name=TenMoTa` | Tạo migration rỗng để viết SQL tay |
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

Xem dữ liệu bằng pgAdmin cài trên máy: Register → Server, tab Connection điền theo `make db-info` (host `localhost`, cổng `5435`, user/mật khẩu/database `ltwnc`).

## Biến môi trường

Khai trong [.env.example](.env.example). `make env` tạo `.env` và tự bổ sung biến mới; không commit `.env`.

| Biến | Mục đích |
| --- | --- |
| `NODE_ENV`, `PORT`, `FRONTEND_URL` | Môi trường, cổng API, domain frontend (CORS) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Postgres trong Docker |
| `DATABASE_URL` | Chuỗi kết nối app dùng |
| `JWT_ACCESS_SECRET` | Khóa ký access token, tối thiểu 32 ký tự; để trống thì `make env` tự sinh cho dev |
| `JWT_ACCESS_EXPIRES_IN` | Thời hạn access token, vd `15m` |
