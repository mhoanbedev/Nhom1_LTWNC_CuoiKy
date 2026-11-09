# Nhom1_LTWNC_CuoiKy – Cổng tuyển dụng thực tập

Bài tập lớn cuối kỳ môn Lập trình Web nâng cao, **Đề 5**: doanh nghiệp đăng tin tuyển thực tập, sinh viên tạo hồ sơ, nộp CV và theo dõi trạng thái ứng tuyển, admin duyệt doanh nghiệp và kiểm soát nội dung. Hỗ trợ song ngữ Việt/Anh.

Kiến trúc C: **Next.js App Router** (frontend) + **NestJS REST API** (backend), chung một monorepo npm workspaces.

## Cấu trúc

```text
Nhom1_LTWNC_CuoiKy/
├── apps/
│   ├── api/        NestJS + TypeORM + PostgreSQL (backend)
│   └── web/        Next.js (frontend)
├── packages/
│   └── shared/     enum, schema Zod, kiểu dùng chung, hàm nghiệp vụ thuần
└── docs/
    └── SPEC-BACKEND.md   đặc tả backend
```

## Yêu cầu

- Node.js 24 LTS (xem `.nvmrc`) và npm 10 trở lên
- Docker Desktop (chạy PostgreSQL và pgAdmin khi dev)
- `make` (tùy chọn, để gõ lệnh tắt; trên Windows dùng Git Bash hoặc `choco install make`)

## Cài đặt và chạy

> Đang dựng. Hướng dẫn chi tiết sẽ bổ sung khi có `apps/api` và `apps/web`.

```bash
npm install
```

## Tài khoản demo

> Bổ sung sau khi có script seed.

## Tài liệu

- [Đặc tả backend](docs/SPEC-BACKEND.md)
