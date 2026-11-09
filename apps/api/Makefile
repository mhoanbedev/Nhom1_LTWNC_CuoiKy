# Lối tắt cho lệnh hay dùng của backend. Chạy trong thư mục apps/api.
# Mỗi target chỉ gọi lại npm script, docker compose hoặc script Node, để chạy được cả trên
# cmd.exe lẫn Git Bash; logic nằm trong package.json nên không có make vẫn chạy được bằng npm.
# Dòng `target: ## mô tả` chính là nội dung của `make help`.

.DEFAULT_GOAL := help
.PHONY: help setup env install up down logs ps dev build start lint lint-fix format format-check typecheck test test-watch test-cov test-e2e check db-shell pgadmin

##@ Chung
help: ## In danh sách lệnh
	@node scripts/make-help.mjs

setup: install env up ## Lần đầu: cài dependency, tạo .env, bật Docker
	@node scripts/pgadmin-info.mjs

env: ## Tạo .env từ .env.example hoặc bổ sung biến còn thiếu
	@node scripts/env.mjs

install: ## Cài dependency (chạy ở gốc monorepo)
	npm install --prefix ../..

##@ Docker (PostgreSQL + pgAdmin)
up: ## Bật Postgres và pgAdmin
	docker compose up -d --wait

down: ## Tắt Postgres và pgAdmin (giữ dữ liệu)
	docker compose down

logs: ## Xem log container
	docker compose logs -f

ps: ## Xem trạng thái container
	docker compose ps

db-shell: ## Mở psql trong container
	docker compose exec postgres sh -c "psql -U $$POSTGRES_USER -d $$POSTGRES_DB"

pgadmin: ## In URL và tài khoản pgAdmin
	@node scripts/pgadmin-info.mjs

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
