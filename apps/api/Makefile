# Lối tắt cho lệnh hay dùng của backend. Chạy trong thư mục apps/api.
# Mỗi target chỉ gọi lại npm script, docker compose hoặc script Node, để chạy được cả trên
# cmd.exe lẫn Git Bash; logic nằm trong package.json nên không có make vẫn chạy được bằng npm.
# Dòng `target: ## mô tả` chính là nội dung của `make help`.

.DEFAULT_GOAL := help
.PHONY: help setup env install up down logs ps dev build start lint lint-fix format format-check typecheck test test-watch test-cov test-e2e check db-shell db-info migrate migrate-revert migration-show migration-generate migration-create seed cloudinary-check

##@ Chung
help: ## In danh sách lệnh
	@node scripts/make-help.mjs

setup: install env up migrate seed ## Lần đầu: cài dependency, tạo .env, bật Postgres, chạy migration, seed
	@node scripts/db-info.mjs

env: ## Tạo .env từ .env.example hoặc bổ sung biến còn thiếu
	@node scripts/env.mjs

install: ## Cài dependency (chạy ở gốc monorepo)
	npm install --prefix ../..

##@ Docker (PostgreSQL)
up: ## Bật Postgres
	docker compose up -d --wait

down: ## Tắt Postgres (giữ dữ liệu)
	docker compose down

logs: ## Xem log container
	docker compose logs -f

ps: ## Xem trạng thái container
	docker compose ps

db-shell: ## Mở psql trong container
	docker compose exec postgres sh -c "psql -U $$POSTGRES_USER -d $$POSTGRES_DB"

db-info: ## In thông số kết nối Postgres cho pgAdmin trên máy
	@node scripts/db-info.mjs

##@ Migration (TypeORM)
migrate: ## Chạy các migration chưa chạy
	npm run migration:run

migrate-revert: ## Lùi migration gần nhất
	npm run migration:revert

migration-show: ## Liệt kê migration và trạng thái đã chạy
	npm run migration:show

migration-generate: ## Sinh migration từ thay đổi entity: make migration-generate name=AddJobIndex
	$(if $(name),,$(error Thiếu tên: make migration-generate name=TenMoTa))
	npm run migration:generate -- src/database/migrations/$(name)

migration-create: ## Tạo migration rỗng để viết SQL tay: make migration-create name=TenMoTa
	$(if $(name),,$(error Thiếu tên: make migration-create name=TenMoTa))
	npm run migration:create -- src/database/migrations/$(name)

seed: ## Seed danh mục (kỹ năng, ngành, tỉnh/thành) và tài khoản admin; chạy lại được
	npm run build --prefix ../.. -w @ltwnc/shared
	npm run seed

cloudinary-check: ## Thử key Cloudinary: upload ảnh và PDF riêng tư vào folder dev-check, in link
	npm run build --prefix ../.. -w @ltwnc/shared
	npm run cloudinary:check

##@ Phát triển
dev: ## Chạy API ở chế độ watch (build packages/shared trước)
	npm run build --prefix ../.. -w @ltwnc/shared
	npm run dev

build: ## Build packages/shared và API
	npm run build --prefix ../.. -w @ltwnc/shared
	npm run build

start: ## Chạy bản build production trên máy
	npm run start

##@ Kiểm tra
lint: ## Lint
	npm run lint

lint-fix: ## Lint và tự sửa
	npm run lint:fix

format: ## Định dạng code bằng Prettier
	npm run format

format-check: ## Kiểm tra định dạng
	npm run format:check

typecheck: ## Kiểm tra kiểu
	npm run build --prefix ../.. -w @ltwnc/shared
	npm run typecheck

test: ## Chạy unit test
	npm run test

test-watch: ## Chạy test ở chế độ watch
	npm run test:watch

test-cov: ## Chạy test kèm coverage
	npm run test:cov

test-e2e: ## Chạy test e2e
	npm run test:e2e

check: ## format + lint + typecheck + test cho api và shared; bắt buộc xanh trước khi push
	npm run check --prefix ../..
