# @ltwnc/api – Backend NestJS

REST API cho cổng tuyển dụng thực tập. Đặc tả: [docs/SPEC-BACKEND.md](../../docs/SPEC-BACKEND.md).

## Chạy lần đầu

Cần Node.js 24, Docker Desktop đang chạy và `make` (trên Windows dùng Git Bash hoặc `choco install make`).

```bash
cd apps/api
make setup   # cài dependency, tạo .env, bật Postgres + pgAdmin
make dev     # chạy API ở http://localhost:4000/api/v1
```

Không có `make` thì dùng npm tương ứng: `npm install` ở gốc, `node scripts/env.mjs`, `docker compose up -d --wait`, `npm run dev`.

## Lệnh make

Gõ `make` để xem đầy đủ.

| Lệnh | Việc làm |
| --- | --- |
| `make setup` | Lần đầu: cài dependency, tạo `.env`, bật Docker |
| `make env` | Tạo `.env` từ `.env.example` hoặc bổ sung biến còn thiếu |
| `make up` / `make down` | Bật / tắt Postgres và pgAdmin (giữ dữ liệu) |
| `make logs` / `make ps` | Xem log / trạng thái container |
| `make db-shell` | Mở `psql` trong container |
| `make pgadmin` | In URL và tài khoản pgAdmin |
| `make dev` | Chạy API ở chế độ watch |
| `make build` / `make start` | Build và chạy bản production trên máy |
| `make lint` / `make format` / `make typecheck` | Kiểm tra và định dạng code |
| `make test` / `make test-watch` / `make test-cov` / `make test-e2e` | Chạy test |
| `make check` | format + lint + typecheck + test; bắt buộc xanh trước khi push |

## Cổng dev

| Thành phần | Địa chỉ |
| --- | --- |
| API | `http://localhost:4000/api/v1` |
| PostgreSQL (Docker) | `localhost:5434` (5432 thường bị PostgreSQL cài sẵn chiếm) |
| pgAdmin | `http://localhost:5050` |

## Biến môi trường

Khai trong [.env.example](.env.example). `make env` tạo `.env` và tự bổ sung biến mới; không commit `.env`.

| Biến | Mục đích |
| --- | --- |
| `NODE_ENV`, `PORT`, `FRONTEND_URL` | Môi trường, cổng API, domain frontend (CORS) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Postgres trong Docker |
| `PGADMIN_DEFAULT_EMAIL`, `PGADMIN_DEFAULT_PASSWORD`, `PGADMIN_PORT` | Tài khoản và cổng pgAdmin |
| `DATABASE_URL` | Chuỗi kết nối app dùng |
