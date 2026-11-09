# Luật chung của monorepo

Dự án: Cổng tuyển dụng thực tập (Đề 5, môn Lập trình Web nâng cao), kiến trúc C: Next.js + NestJS.
Đặc tả backend: [docs/SPEC-BACKEND.md](docs/SPEC-BACKEND.md). Đọc trước khi làm.

## Cấu trúc

- `apps/api`: NestJS + TypeORM + PostgreSQL. Chỉ Hoàn sửa. Luật chi tiết ở `apps/api/CLAUDE.md`.
- `apps/web`: Next.js, nhóm frontend.
- `packages/shared`: enum, schema Zod, kiểu response, hàm nghiệp vụ thuần dùng chung. Mọi thay đổi qua pull request có Hoàn review.

## Bắt buộc

- Node.js 24 LTS (`.nvmrc`), quản lý gói bằng **npm workspaces**. `npm install`/`npm ci` chỉ chạy ở gốc repo; cài gói cho một workspace bằng `npm install <gói> --workspace=@ltwnc/<tên>`.
- TypeScript `strict: true`, không `any` nếu không có chú thích lý do.
- Không commit `.env` hay secret. Thêm biến môi trường thì cập nhật `.env.example` của workspace đó.
- Nhánh: `main` luôn chạy được; làm trên `feat/api-<bước>`, `feat/web-<tính năng>`, `fix/...` rồi mở pull request.
- Commit theo Conventional Commits có scope: `feat(api): ...`, `fix(web): ...`, `feat(shared): ...`; mỗi commit một việc.
- Đổi API đã bàn giao thì ghi `apps/api/CHANGELOG-API.md` và báo nhóm.
