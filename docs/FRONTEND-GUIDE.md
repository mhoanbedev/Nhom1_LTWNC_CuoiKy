# Hướng dẫn cho frontend (`apps/web`)

Tài liệu này chỉ gồm những điểm frontend **phải khớp** với backend. Giao diện, cấu trúc trang, thư viện component là việc của nhóm frontend. Chi tiết từng endpoint xem Swagger (`http://localhost:4000/api/docs`) hoặc [apps/api/openapi.json](../apps/api/openapi.json); nghiệp vụ đầy đủ xem [SPEC-BACKEND.md](SPEC-BACKEND.md).

`apps/web` là Next.js **16** (App Router). Bản này khác nhiều so với tài liệu cũ trên mạng: `middleware.ts` đổi thành `proxy.ts`, cache dùng `'use cache'` + `cacheTag`, `revalidateTag` cần tham số thứ hai. Tài liệu đúng phiên bản nằm trong `node_modules/next/dist/docs/` (xem [apps/web/AGENTS.md](../apps/web/AGENTS.md)).

## 1. Gọi API

- Base URL: `http://localhost:4000/api/v1`. Đặt trong env của web, vd `API_URL` (gọi từ server) và `NEXT_PUBLIC_API_URL` (gọi từ trình duyệt, nếu cần).
- Nên gọi API **từ server** (Server Component, Server Action, Route Handler): token nằm trong session của Auth.js, không lộ ra trình duyệt. Backend chỉ mở CORS cho `FRONTEND_URL` (dev: `http://localhost:3000`).
- Route cần đăng nhập: gửi header `Authorization: Bearer <accessToken>`.
- Ngôn ngữ: thêm `?lang=vi` hoặc `?lang=en` (không có thì theo header `Accept-Language`, mặc định `vi`). Nội dung (tên tin, kỹ năng...) và câu lỗi đều theo ngôn ngữ này.
- Response thành công: `{ data }`; danh sách có phân trang: `{ data, meta: { page, limit, total, totalPages } }` (query `?page=1&limit=20`, tối đa 50).
- Response lỗi luôn có dạng `ApiError` (kiểu trong `@ltwnc/shared`):

  ```json
  {
    "statusCode": 400,
    "code": "VALIDATION_FAILED",
    "message": "Dữ liệu không hợp lệ",
    "details": [{ "field": "email", "message": "Email không hợp lệ" }],
    "path": "/api/v1/auth/register/candidate",
    "timestamp": "2026-11-10T03:00:00.000Z",
    "requestId": "..."
  }
  ```

  Rẽ nhánh theo `code` (enum `ErrorCode`), hiện `message` cho người dùng (đã dịch), gắn `details[].message` vào đúng ô form theo `field`.
- 429 `TOO_MANY_REQUESTS` (đăng nhập, đăng ký, refresh, Google): đọc header `Retry-After` (giây) để báo người dùng chờ.

## 2. Đăng nhập với Auth.js

Backend cấp token; Auth.js chỉ giữ token trong session. Đặc tả đầy đủ: [mục 6](SPEC-BACKEND.md#6-xác-thực).

| Việc | Endpoint | Body |
| --- | --- | --- |
| Đăng ký ứng viên | `POST /auth/register/candidate` | `{ email, password, name }` |
| Đăng ký nhà tuyển dụng | `POST /auth/register/recruiter` | `{ email, password, name, company: { translations: { vi: { name } } } }` |
| Đăng nhập (provider Credentials) | `POST /auth/login` | `{ email, password }` |
| Đăng nhập Google (provider Google) | `POST /auth/oauth/google` | `{ idToken }` (lấy `account.id_token` trong callback của Auth.js) |
| Làm mới token | `POST /auth/refresh` | `{ refreshToken }` |
| Đăng xuất | `POST /auth/logout` (cần Bearer) | `{ refreshToken }` |

Cả 5 endpoint đầu trả `AuthResponse`: `{ accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, user: { id, email, name, role, companyId, preferredLocale, avatarUrl } }`.

- Callback `jwt`: lưu cả hai token, hai mốc hết hạn, `user`. Khi access token **còn dưới 60 giây** (sống 15 phút) thì gọi `/auth/refresh` và thay **cả cặp** token (refresh token xoay vòng: mỗi cái dùng một lần, trong 30 giây đầu dùng lại vẫn được để hai request song song không bị đăng xuất).
- Refresh trả 401 (`AUTH_REFRESH_INVALID`, `AUTH_REFRESH_REUSED`) hay 403 `AUTH_ACCOUNT_LOCKED`: gắn `error: 'RefreshTokenError'` vào session, giao diện buộc đăng nhập lại.
- `maxAge` của session: 7 ngày (bằng refresh token).
- Chặn trang theo vai trò ở `proxy.ts` (`user.role`: `CANDIDATE`, `RECRUITER`, `ADMIN`) chỉ để điều hướng cho tiện; quyền thật luôn do backend kiểm (sai vai trò 403).
- Mật khẩu: tối thiểu 8 ký tự, có cả chữ và số (`passwordSchema` trong `@ltwnc/shared`).

## 3. Dùng `@ltwnc/shared`

Đã khai sẵn trong `apps/web/package.json`; `npm run dev:web` tự build trước. Sửa `packages/shared` thì chạy `npm run build:shared`.

| Cần | Import |
| --- | --- |
| Validate form giống hệt backend | Schema Zod: `loginSchema`, `registerCandidateSchema`, `createJobSchema`, schema 4 bước hồ sơ... |
| Kiểu response | `AuthResponse`, `PublicJobDetail`, `RecruiterJob`, `CandidateApplication`, `Paginated<T>`, `ApiError`... |
| Mã lỗi | `ErrorCode` |
| Enum | `Role`, `JobStatus`, `ApplicationStatus`, `WorkMode`, `LOCALES`... |
| Nút đổi trạng thái đơn | `nextStatuses(status, ApplicationActor.RECRUITER)` |
| Thanh tiến độ hồ sơ | `profileCompletion(completedSteps)` |
| JSON-LD tin tuyển | `buildJobPostingJsonLd(job)` + `serializeJsonLd(...)` (trả `null` khi tin không được index) |
| Cache tag, header revalidate | `RevalidateTag`, `REVALIDATE_SECRET_HEADER` |

## 4. Cache và revalidate

Backend gọi webhook mỗi khi dữ liệu công khai đổi (đăng, sửa, đóng tin; admin duyệt công ty, ẩn tin; cron đóng tin hết hạn...). Đặc tả: [mục 9](SPEC-BACKEND.md#9-hỗ-trợ-seo-và-render-cho-frontend).

- Gắn tag khi lấy dữ liệu công khai, dùng đúng tên trong `RevalidateTag`: `job:{id}` (trang tin, kèm cả `company:{companyId}`), `company:{id}`, `jobs:list`, `companies:list`, `sitemap`. Với `cacheComponents` (đang bật trong `next.config.ts`): hàm lấy dữ liệu có `'use cache'` và gọi `cacheTag(...)`.
- Route Handler nhận webhook:

  ```ts
  // apps/web/src/app/api/revalidate/route.ts
  import { revalidateTag } from 'next/cache';
  import { REVALIDATE_SECRET_HEADER, type RevalidatePayload } from '@ltwnc/shared';

  export async function POST(request: Request) {
    if (request.headers.get(REVALIDATE_SECRET_HEADER) !== process.env.REVALIDATE_SECRET) {
      return new Response(null, { status: 401 });
    }
    const { tags } = (await request.json()) as RevalidatePayload;
    for (const tag of tags) revalidateTag(tag, 'max');
    return Response.json({ revalidated: tags.length });
  }
  ```

- Dev: copy `REVALIDATE_SECRET` trong `apps/api/.env` sang env của web, và đặt `REVALIDATE_URL=http://localhost:3000/api/revalidate` trong `apps/api/.env`. Chưa có Route Handler thì để trống `REVALIDATE_URL` (backend chỉ ghi log).

## 5. SEO

- Chi tiết tin `GET /jobs/:slug?lang=` và trang công ty `GET /companies/:slug?lang=`:
  - `canonicalSlug` khác slug trên URL thì redirect 308 sang slug đúng.
  - `alternates: [{ locale, slug }]` chỉ gồm ngôn ngữ đã có bản dịch: dựng hreflang và `x-default` (bản `vi`); không tạo URL `/en` khi tin chưa có bản `en`.
  - Tin: `seo.indexable: false` (đã đóng, hết hạn) thì đặt `noindex` và ẩn nút ứng tuyển (`isAcceptingApplications`); 404 thì gọi `notFound()`.
- `sitemap.ts`: lấy `GET /seo/sitemap` (`{ type, id, updatedAt, alternates }[]`), mỗi phần tử của `alternates` là một URL, `updatedAt` làm `lastModified`, gắn tag `sitemap`.
- `generateStaticParams`: `GET /seo/static-params?type=job&limit=100` trả `{ locale, slug }[]`.
- URL dùng `/vi/...` và `/en/...`.

## 6. Thông báo realtime (SSE)

`GET /me/notifications/stream` đẩy sự kiện `unread-count` (`{ count }`) khi kết nối và mỗi khi số chưa đọc đổi; `ping` mỗi 25 giây. Stream tự đóng khi access token hết hạn hoặc tài khoản bị khóa. `EventSource` của trình duyệt không gửi được header `Authorization`, nên đi qua một Route Handler của Next:

```ts
// apps/web/src/app/api/notifications/stream/route.ts
import { auth } from '@/auth'; // cấu hình Auth.js của nhóm

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) return new Response(null, { status: 401 });
  const upstream = await fetch(`${process.env.API_URL}/me/notifications/stream`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
  });
}
```

Phía client: `new EventSource('/api/notifications/stream')`, nghe `addEventListener('unread-count', ...)`. Stream đóng thì `EventSource` tự kết nối lại (lúc đó Auth.js đã refresh token). Danh sách thông báo vẫn lấy bằng `GET /me/notifications`; `GET /me/notifications/unread-count` dùng làm dự phòng.

## 7. Upload và tải file

| Việc | Endpoint | Giới hạn |
| --- | --- | --- |
| Avatar | `POST /auth/me/avatar` | JPG/PNG/WebP, tối đa 2 MB |
| Logo công ty | `POST /recruiter/company/logo` | JPG/PNG/WebP, tối đa 2 MB |
| CV | `POST /me/cvs` | Chỉ PDF, tối đa 5 MB, mỗi ứng viên tối đa 5 CV |

- Gửi `multipart/form-data`, field tên **`file`**. File quá cỡ trả 400 `FILE_TOO_LARGE`.
- Tải CV: `GET /files/cvs/:id` trả `{ url, expiresAt }`, link ký sẵn **sống 60 giây**. Gọi ngay khi người dùng bấm tải rồi mở `url`, không lưu link lại. Ứng viên tải CV của mình; nhà tuyển dụng tải CV nộp vào tin của công ty mình.

## 8. Sinh kiểu từ OpenAPI (tùy chọn)

Kiểu dùng chung đã có trong `@ltwnc/shared`. Muốn kiểu cho từng endpoint thì sinh từ file OpenAPI:

```bash
npx openapi-typescript apps/api/openapi.json -o apps/web/src/lib/api-schema.d.ts
```

Backend đổi API thì `openapi.json` được cập nhật trong cùng pull request; sinh lại kiểu sau khi pull.

## 9. Hay gặp

- **Lỗi CORS** khi gọi từ trình duyệt: web không chạy ở `http://localhost:3000` (giá trị `FRONTEND_URL` trong `apps/api/.env`). Gọi từ server thì không bị CORS.
- **Cổng 3000 bị chiếm**: chạy `next dev -p <cổng khác>` và sửa `FRONTEND_URL` theo.
- **401 giữa chừng**: access token hết hạn mà chưa refresh; kiểm callback `jwt`.
- **403 `AUTH_ACCOUNT_LOCKED`**: tài khoản bị admin khóa, buộc đăng xuất.
- **400 `PROFILE_INCOMPLETE` khi nộp đơn**: hồ sơ chưa xong 3 bước bắt buộc; dùng `profileCompletion` để dẫn người dùng đi làm tiếp.
- **Dữ liệu demo bị đổi khi thử**: `cd apps/api && make seed-demo` để tạo lại.
