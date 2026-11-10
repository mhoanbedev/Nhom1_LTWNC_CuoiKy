# Nhom1_LTWNC_CuoiKy – Cổng tuyển dụng thực tập

Bài tập lớn cuối kỳ môn Lập trình Web nâng cao, **Đề 5**: doanh nghiệp đăng tin tuyển thực tập, sinh viên tạo hồ sơ, nộp CV và theo dõi trạng thái ứng tuyển, admin duyệt doanh nghiệp và kiểm soát nội dung. Song ngữ Việt/Anh, tin tuyển và trang công ty được Google index.

Kiến trúc C: **Next.js App Router** (frontend) + **NestJS REST API** (backend), chung một monorepo npm workspaces.

## Cấu trúc

```text
Nhom1_LTWNC_CuoiKy/
├── apps/
│   ├── api/        NestJS + TypeORM + PostgreSQL (backend), README riêng
│   └── web/        Next.js 16 (frontend)
├── packages/
│   └── shared/     enum, schema Zod, kiểu response, hàm nghiệp vụ thuần; cả api và web import
└── docs/
    ├── SPEC-BACKEND.md     đặc tả backend (nghiệp vụ, API, quyền, SEO)
    └── FRONTEND-GUIDE.md   những điểm frontend phải khớp với backend
```

## Yêu cầu

- **Node.js 24 LTS** (xem `.nvmrc`) và npm 10 trở lên.
- **Docker Desktop**: chạy PostgreSQL và Mailpit (hộp thư giả để xem email) khi dev.
- `make` (tùy chọn) cho lệnh tắt của backend. Trên Windows dùng Git Bash hoặc `choco install make`. Không có `make` thì xem lệnh `npm` tương ứng trong [apps/api/Makefile](apps/api/Makefile).

## Chạy lần đầu

```bash
npm install                      # ở gốc repo; chỉ chạy npm install ở đây

cd apps/api
make env                         # tạo apps/api/.env từ .env.example
```

Mở `apps/api/.env`, điền 3 biến `CLOUDINARY_*` (backend lưu ảnh và CV trên Cloudinary; seed demo cũng upload CV mẫu). Cách lấy key: mục "Biến môi trường" trong [apps/api/README.md](apps/api/README.md). Các biến còn lại để mặc định là chạy được.

```bash
make setup                       # bật Postgres + Mailpit, chạy migration, seed danh mục, admin, dữ liệu demo
make dev                         # backend: http://localhost:4000/api/docs
```

Sau đó mở terminal khác ở gốc repo:

```bash
npm run dev:web                  # frontend: http://localhost:3000
```

`dev:web` tự build `packages/shared` trước. Sửa code trong `packages/shared` thì chạy lại `npm run build:shared`.

## Cổng dev

| Thành phần | Địa chỉ |
| --- | --- |
| Frontend (Next.js) | http://localhost:3000 |
| API | http://localhost:4000/api/v1 |
| Swagger UI | http://localhost:4000/api/docs (file: [apps/api/openapi.json](apps/api/openapi.json)) |
| Mailpit: xem email đã gửi | http://localhost:8025 |
| PostgreSQL (Docker) | `localhost:5435`, user/mật khẩu/database `ltwnc` |

## Tài khoản demo

Có sau `make setup` (hoặc `make seed` + `make seed-demo`). Mật khẩu chung **`Demo@2026`**.

| Vai trò | Email | Dùng để |
| --- | --- | --- |
| Admin | `admin@demo.vn` | Duyệt công ty, ẩn tin, khóa user, thống kê |
| Nhà tuyển dụng | `recruiter@demo.vn` | Công ty đã duyệt, nhiều tin; một tin có 255 đơn |
| Nhà tuyển dụng | `recruiter.pending@demo.vn` | Công ty đang chờ duyệt |
| Ứng viên | `candidate@demo.vn` | Hồ sơ đủ, 2 CV, đơn ở nhiều trạng thái, thông báo, tin đã lưu |
| Ứng viên | `candidate.new@demo.vn` | Hồ sơ trống: nộp đơn ra lỗi `PROFILE_INCOMPLETE` |

Dữ liệu demo tạo lại được bằng `make seed-demo`; dữ liệu tự tạo bằng email khác `@demo.vn` giữ nguyên.

## Lệnh ở gốc repo

| Lệnh | Việc làm |
| --- | --- |
| `npm run dev:api` / `npm run dev:web` | Chạy backend / frontend ở chế độ dev |
| `npm run build:shared` | Build `packages/shared` (cần trước khi api hay web dùng bản mới) |
| `npm run lint` / `npm run typecheck` / `npm run test` | Chạy cho mọi workspace |
| `npm run check` | format + lint + typecheck + test cho mọi workspace; chạy trước khi push |

Lệnh riêng của backend (migration, seed, test e2e, reset DB...): [apps/api/README.md](apps/api/README.md).

## Quy trình làm việc

- `main` luôn chạy được. Làm trên nhánh riêng (`feat/web-<tính năng>`, `feat/api-<module>`, `fix/...`), mở pull request vào `main`.
- Commit theo Conventional Commits có scope: `feat(web): ...`, `fix(api): ...`, `feat(shared): ...`.
- `packages/shared` dùng chung cho cả hai bên: mọi thay đổi đi qua pull request có người phụ trách backend review.
- Frontend cần thêm hay đổi API thì mở issue ghi rõ endpoint, input, output mong muốn.

## Tài liệu

- [docs/FRONTEND-GUIDE.md](docs/FRONTEND-GUIDE.md): gọi API, đăng nhập (Auth.js), revalidate, SEO, thông báo realtime, upload file.
- [docs/SPEC-BACKEND.md](docs/SPEC-BACKEND.md): đặc tả đầy đủ (nghiệp vụ, danh sách API, phân quyền, mã lỗi).
- [apps/api/README.md](apps/api/README.md): chạy backend, biến môi trường, lệnh `make`.
- Swagger `http://localhost:4000/api/docs` hoặc [apps/api/openapi.json](apps/api/openapi.json): chi tiết từng endpoint.
