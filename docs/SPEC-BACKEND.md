# Đặc tả Backend – Đề 5: Cổng tuyển dụng thực tập

Nov 8, 2026 · @Vu Minh Hoan

## 1. Tổng quan và phạm vi

Backend là một API NestJS độc lập (kiến trúc C), lo toàn bộ dữ liệu, nghiệp vụ và phân quyền cho frontend Next.js của nhóm. Mục tiêu: đủ phần backend của 8 nhóm yêu cầu chung, toàn bộ yêu cầu riêng của đề 5 và cả 3 mục nâng cao.

**Bài toán:** doanh nghiệp đăng tin tuyển thực tập; sinh viên tạo hồ sơ, nộp CV và theo dõi trạng thái ứng tuyển; admin duyệt doanh nghiệp và kiểm soát nội dung. Tin tuyển và trang công ty có hai ngôn ngữ Việt/Anh và phải được Google index.

**Mức "điểm tối đa" cần đạt:**

- Đủ 8 nhóm yêu cầu chung và đủ yêu cầu riêng đề 5.
- Cả 3 mục nâng cao: gợi ý việc theo độ khớp kỹ năng, thông báo khi trạng thái hồ sơ đổi, song ngữ Việt/Anh có hreflang.
- Có link triển khai (tính vào điểm nâng cao).
- Swagger: đề 5 không bắt buộc, nhưng giúp bàn giao cho nhóm và gây ấn tượng khi bảo vệ.

**Phân ranh giới backend và frontend:**

| Hạng mục | Backend NestJS (Hoàn) | Frontend Next.js (nhóm) |
| --- | --- | --- |
| Dữ liệu, nghiệp vụ | Toàn bộ API, DB, validate, chuyển trạng thái, kiểm quyền sở hữu | Gọi API qua Server Action / Route Handler, kiểm session trước khi gọi |
| Xác thực | Endpoint đăng ký, đăng nhập, OAuth Google; cấp và verify JWT; Guard | Cấu hình Auth.js, Middleware chặn route theo role |
| Render, SEO | Dữ liệu cho JSON-LD, sitemap, slug theo ngôn ngữ, webhook revalidate | SSG/ISR/SSR, Metadata API, sitemap.ts, robots, opengraph-image, hreflang |
| Đa ngôn ngữ | Nội dung song ngữ, thông báo lỗi theo ngôn ngữ, tìm kiếm theo ngôn ngữ | Chuỗi giao diện (next-intl), route /vi và /en |
| CV | Nhận, kiểm tra, lưu private, tải có kiểm quyền | Form upload, nút tải |
| Kiểm thử | Unit hàm thuần, test service mock repository, e2e phân quyền | Test component RTL, store, hook |

**Stack** (đã chốt):

- NestJS + TypeScript `strict: true`, PostgreSQL 16 + TypeORM. Node.js 24 LTS (ghi trong .nvmrc), NestJS 11, quản lý gói bằng npm workspaces (npm install chỉ chạy ở gốc, một package-lock.json chung). Mọi thay đổi schema đi qua migration, `synchronize` luôn tắt.
- Zod qua `nestjs-zod` (`createZodDto` + `ZodValidationPipe`). Schema đặt ở `packages/shared` để frontend dùng lại khi validate từng bước form hồ sơ.
- `@nestjs/jwt` + `passport-jwt`, mật khẩu băm bằng argon2, `google-auth-library` để verify id\_token Google.
- `nestjs-i18n` cho thông báo lỗi song ngữ.
- File: Multer (memoryStorage, không ghi đĩa) + **Cloudinary**. Ảnh (logo, avatar) để công khai; CV để chế độ `authenticated` và chỉ tải được qua signed URL ngắn hạn (mục 5.5).
- `@nestjs/swagger`, `@nestjs/schedule` (cron đóng tin hết hạn), `@nestjs/event-emitter` (việc chạy sau commit: revalidate, email), `@nestjs/throttler`, `helmet`.
- Jest + supertest.
- **Dev:** Docker Compose chỉ chạy PostgreSQL; xem dữ liệu bằng pgAdmin cài trên máy (`make db-info` in thông số kết nối); mọi lệnh gọi qua **Makefile** (mục 10).
- **Deploy:** backend lên **Render** bằng Dockerfile, database production trên Neon; frontend lên Vercel.

### Repo và phân công

Hoàn tạo monorepo và làm **toàn bộ backend** (`apps/api`), đồng thời duy trì `packages/shared`. Nhóm frontend làm `apps/web`. Tên package: @ltwnc/api, @ltwnc/shared, @ltwnc/web. Repo đặt tên theo đề: `Nhom1_LTWNC_CuoiKy`.

```text
Nhom1_LTWNC_CuoiKy/
├── apps/
│   ├── api/          NestJS — Hoàn sở hữu toàn bộ
│   └── web/          Next.js — nhóm frontend
├── packages/
│   └── shared/       enum, schema Zod, kiểu response, hàm nghiệp vụ thuần — Hoàn duy trì
├── docs/
│   └── SPEC-BACKEND.md   tài liệu này
├── CLAUDE.md         luật chung cho Claude CLI ở cấp monorepo
├── package.json      script gốc, khai báo npm workspaces
├── package-lock.json     lock chung cho cả monorepo
├── .editorconfig, .gitignore, .nvmrc
└── README.md         giới thiệu dự án, cách chạy cả hai app
```

Quy tắc phối hợp:

- Thành viên frontend không sửa `apps/api`. Cần thêm hay đổi API thì mở issue ghi rõ endpoint, input, output mong muốn.
- `packages/shared` ảnh hưởng cả hai bên, nên mọi thay đổi đi qua pull request có Hoàn review.
- API đã bàn giao mà phải đổi thì ghi vào `apps/api/CHANGELOG-API.md` và báo nhóm.
- Nhánh: `main` luôn chạy được; làm trên `feat/api-<module>`, `feat/web-<feature>`, `fix/...` rồi mở pull request vào `main`.
- Commit theo Conventional Commits có scope: `feat(api): ...`, `fix(web): ...`, `feat(shared): ...`. Lịch sử commit là căn cứ chấm điểm cá nhân.
- Khi dùng Claude CLI cho backend: mở trong `apps/api`, chỉ được sửa `apps/api` và `packages/shared`.

## 2. Vai trò và ma trận phân quyền

Hệ thống có 4 vai trò: `GUEST` (chưa đăng nhập), `CANDIDATE`, `RECRUITER`, `ADMIN`. Quyền được kiểm ở hai lớp trong backend: Guard theo vai trò (`@Roles`) và kiểm tra quyền sở hữu trong service. Phía Next có thêm Middleware và Server Action, nên tổng cộng là 4 lớp.

| Chức năng | Guest | Candidate | Recruiter | Admin |
| --- | --- | --- | --- | --- |
| Xem/tìm tin, xem trang công ty | ✓ | ✓ | ✓ | ✓ |
| Lưu tin yêu thích | — | ✓ | — | — |
| Tạo/sửa hồ sơ ứng viên | — | Của mình | — | — |
| Upload, xóa CV | — | Của mình | — | — |
| Ứng tuyển, rút đơn | — | Của mình | — | — |
| Xem đơn ứng tuyển và lịch sử trạng thái | — | Của mình | Đơn vào tin của công ty mình | — |
| Tải CV | — | Của mình | CV đính kèm đơn vào tin của công ty mình | — |
| Sửa trang công ty | — | — | Công ty mình | — |
| Đăng, sửa, đóng tin | — | — | Công ty mình, chỉ khi đã được duyệt | — |
| Chuyển trạng thái hồ sơ, ghi chú nội bộ | — | — | Đơn vào tin của công ty mình | — |
| Thống kê | — | — | Tin của công ty mình | Toàn hệ thống |
| Duyệt/từ chối doanh nghiệp | — | — | — | ✓ |
| Ẩn/bỏ ẩn tin vi phạm | — | — | — | ✓ |
| Khóa/mở khóa tài khoản | — | — | — | ✓ |

**Quy tắc sở hữu, kiểm tra trong service chứ không chỉ ở Guard:**

- Recruiter thuộc đúng một công ty. Mọi thao tác trên tin hay đơn đều kiểm `job.companyId === user.companyId`.
- Candidate chỉ đọc và sửa bản ghi có `candidateId === user.id`.
- Ghi chú nội bộ không bao giờ nằm trong response trả cho candidate.
- Admin **không** tải được CV, vì đề ghi rõ "chỉ ứng viên đó và nhà tuyển dụng của tin".
- Truy cập tài nguyên không phải của mình: trả **403** nếu tài nguyên công khai (ví dụ tin), trả **404** nếu tài nguyên riêng tư (đơn, CV) để không lộ việc nó tồn tại. Ghi rõ quy ước này trong báo cáo.
- Tài khoản bị khóa: mọi request có token đều trả 403 `AUTH_ACCOUNT_LOCKED`, kể cả khi token còn hạn. JwtStrategy phải đọc trạng thái user từ DB, không tin vào payload.

## 3. Đa ngôn ngữ Việt/Anh

Backend lưu nội dung công khai trong bảng dịch và trả đúng ngôn ngữ được yêu cầu, kèm danh sách ngôn ngữ hiện có. Chuỗi giao diện và nhãn enum do frontend dịch.

**Xác định ngôn ngữ của request:** ưu tiên query `?lang=vi|en`, sau đó đến header `Accept-Language`, mặc định là `vi`. Kiểu `Locale = 'vi' | 'en'` đặt trong `packages/shared`. Viết một param decorator `@Lang()` trả về locale đã chuẩn hóa.

| Loại dữ liệu | Cách lưu | Cách trả về |
| --- | --- | --- |
| Nhãn enum (trạng thái, onsite/remote) | Không lưu nhãn, chỉ lưu mã như `INTERVIEW` | Trả mã, frontend dịch bằng next-intl |
| Thông báo lỗi và lỗi validate | File `i18n/vi/*.json`, `i18n/en/*.json` | Exception Filter dịch `message` theo locale, `code` giữ nguyên |
| Danh mục: kỹ năng, ngành, tỉnh/thành | Cột `nameVi`, `nameEn` | Trả một trường `name` theo locale |
| Tin tuyển, trang công ty | Bảng `JobTranslation`, `CompanyTranslation` (locale, slug, nội dung) | Trả bản theo locale; không có bản của locale đó thì 404, không lấy bản `vi` thay |
| Thông báo trong hệ thống, email | Template song ngữ | Sinh theo `preferredLocale` của người nhận |
| Hồ sơ ứng viên, ghi chú | Một bản, do người dùng tự viết | Trả nguyên, không dịch |

**Quy tắc cho nội dung song ngữ:**

- Đăng tin hay sửa trang công ty: bắt buộc có bản `vi`, bản `en` tùy chọn.
- Slug riêng cho từng ngôn ngữ, unique theo cặp (locale, slug). Ví dụ `thuc-tap-backend-nodejs-a1b2c3` và `backend-nodejs-intern-a1b2c3`, đuôi `a1b2c3` là shortId của tin.
- Slug sinh một lần khi tạo bản dịch và không đổi khi sửa tiêu đề, để URL đã index không chết.
- Response chi tiết có `locale`, `canonicalSlug` (slug chuẩn của locale đó) và `alternates: { locale, slug }[]` chỉ gồm ngôn ngữ có bản dịch. Frontend dựng hreflang và canonical từ đây; slug trên URL khác `canonicalSlug` thì redirect 308.
- Chi tiết tin tìm theo `shortId` ở cuối slug, chi tiết công ty tìm theo slug ở mọi ngôn ngữ. Có bản dịch theo `lang` thì trả bản đó, không có thì **404** (không lấy bản `vi` thay), nên không có trang `/en` nào mang nội dung tiếng Việt. Tìm kiếm chạy trên bản dịch của locale được yêu cầu; tin chỉ có bản `vi` vẫn hiện trong kết quả tiếng Anh, kèm `locale: 'vi'` để frontend dẫn link về `/vi/...`.
- Mỗi bản dịch có cột `searchText` đã bỏ dấu và viết thường ("Thực tập" thành "thuc tap") để gõ không dấu vẫn ra kết quả, đánh index trigram (`pg_trgm`).
- User có `preferredLocale`, đổi qua `PATCH /auth/me` khi người dùng chuyển ngôn ngữ trên giao diện.

## 4. Mô hình dữ liệu

Mô hình gồm 21 entity TypeORM, cùng kế thừa lớp trừu tượng AppBaseEntity (id kiểu uuid, createdAt, updatedAt). Bảng dưới chỉ liệt kê trường nghiệp vụ; bảng nào cũng có thêm `id`, `createdAt`, `updatedAt`.

| Bảng | Trường chính | Ghi chú |
| --- | --- | --- |
| **User** | email (unique), passwordHash (null nếu chỉ đăng nhập Google), passwordChangedAt, name, role, status, preferredLocale, avatarUrl, companyId | companyId chỉ có với recruiter |
| **Account** | userId, provider, providerAccountId | Liên kết OAuth, unique (provider, providerAccountId) |
| **Company** | ownerId, status, rejectReason, logoUrl, logoPublicId, website, size, industryId, locationId, address, approvedAt | Unique (ownerId): mỗi recruiter một công ty. `size` là `1-10`, `11-50`, `51-200`, `201-500`, `500+` |
| **CompanyTranslation** | companyId, locale, name, slug, description, searchText | Unique (companyId, locale) và (locale, slug) |
| **Job** | shortId, companyId, status, isHidden, hiddenReason, workMode, isPaid, salaryMin, salaryMax, currency, locationId, address, quantity, expiresAt, publishedAt, closedAt | Index (status, isHidden, expiresAt), (companyId) |
| **JobTranslation** | jobId, locale, title, slug, description, requirements, benefits, searchText | Nội dung dạng Markdown; index trigram trên searchText, viết bằng SQL trong migration vì decorator của TypeORM không khai báo được |
| **JobSkill** | jobId, skillId, isRequired | Phân biệt kỹ năng bắt buộc và ưu tiên, dùng cho điểm khớp |
| **Skill** | slug, nameVi, nameEn | Danh mục |
| **Industry** | slug, nameVi, nameEn | Danh mục |
| **Location** | code, nameVi, nameEn | 34 tỉnh/thành sau sắp xếp năm 2025 |
| **CandidateProfile** | userId (unique), headline, phone, dateOfBirth, locationId, about, links (JSON), completedSteps | completedSteps là mảng ProfileStep |
| **Education** | profileId, school, major, degree, startDate, endDate, gpa |  |
| **CandidateSkill** | profileId, skillId, level (1–5) |  |
| **Project** | profileId, name, role, description, techStack, url, startDate, endDate |  |
| **CvFile** | candidateId, originalName, cloudinaryPublicId, size, isDefault, deletedAt | Xóa mềm vì đơn đã nộp vẫn trỏ tới |
| **SavedJob** | candidateId, jobId | Unique (candidateId, jobId) |
| **Application** | jobId, candidateId, cvFileId, coverLetter, status, profileSnapshot (JSON), submittedAt | Unique (jobId, candidateId); index (jobId, status) |
| **ApplicationStatusHistory** | applicationId, fromStatus, toStatus, changedById, note | Ghi mỗi lần chuyển trạng thái |
| **ApplicationNote** | applicationId, authorId, content | Ghi chú nội bộ của nhà tuyển dụng |
| **Notification** | userId, type, data (JSON), readAt | Lưu type + tham số, dịch theo locale lúc đọc |
| **RefreshToken** | userId, tokenHash, familyId, expiresAt, revokedAt, replacedById, userAgent, ip | Chỉ lưu hash SHA-256 của token; index (userId), unique (tokenHash). Cron xóa bản ghi hết hạn |

Industry là tùy chọn, có thể bỏ nếu không cần lọc theo ngành.

**Enum** (đặt trong `packages/shared`, entity TypeORM dùng enum Postgres khớp 1-1):

- `Role`: GUEST (chỉ dùng ở tầng phân quyền, không lưu DB), CANDIDATE, RECRUITER, ADMIN
- `UserStatus`: ACTIVE, LOCKED
- `CompanyStatus`: PENDING, APPROVED, REJECTED
- `JobStatus`: DRAFT, PUBLISHED, CLOSED. Việc admin ẩn tin là cờ `isHidden` riêng, để bỏ ẩn thì tin về lại trạng thái cũ.
- `WorkMode`: ONSITE, REMOTE, HYBRID
- `ApplicationStatus`: SUBMITTED, REVIEWING, INTERVIEW, PASSED, FAILED, WITHDRAWN
- `ProfileStep`: BASIC, EDUCATION, SKILLS, PROJECTS
- `NotificationType`: APPLICATION\_STATUS\_CHANGED, NEW\_APPLICATION, COMPANY\_APPROVED, COMPANY\_REJECTED, JOB\_HIDDEN
- `Locale`: vi, en

Tin "hết hạn" không phải một trạng thái riêng: nó được tính từ `expiresAt < now()`. Cron hằng ngày chuyển các tin đó sang CLOSED và bắn revalidate (mục 9).

## 5. Quy tắc nghiệp vụ

Các quy tắc dưới đây là "nghiệp vụ khó" của đề. Quy tắc nào dạng được thì viết thành hàm thuần trong `packages/shared` hoặc `domain/` để unit test và để frontend dùng lại.

### 5.1 Duyệt doanh nghiệp

- Recruiter đăng ký kèm thông tin công ty, công ty sinh ra ở trạng thái PENDING.
- Khi còn PENDING: vẫn đăng nhập và sửa thông tin công ty được, nhưng tạo hay đăng tin trả 403 `COMPANY_NOT_APPROVED`.
- Admin duyệt: công ty sang APPROVED, recruiter nhận thông báo `COMPANY_APPROVED`.
- Admin từ chối: phải có lý do, công ty sang REJECTED. Recruiter sửa rồi gửi lại thì công ty về PENDING.
- Duyệt công ty đã APPROVED thì giữ nguyên (idempotent). Từ chối công ty đã APPROVED là thu hồi duyệt: mọi tin của công ty thôi công khai.
- Trang công ty công khai chỉ hiện khi APPROVED, còn lại trả 404.

### 5.2 Vòng đời tin tuyển

| Từ | Sang | Ai | Điều kiện |
| --- | --- | --- | --- |
| DRAFT | PUBLISHED | Recruiter | Công ty APPROVED, có bản `vi`, `expiresAt > now`, ít nhất 1 kỹ năng; ghi publishedAt |
| PUBLISHED | CLOSED | Recruiter hoặc cron | Đóng tay, hoặc cron thấy đã quá hạn; ghi closedAt |
| CLOSED | PUBLISHED | Recruiter | Mở lại, bắt buộc đặt `expiresAt` mới > now |
| DRAFT | (xóa) | Recruiter | Chỉ xóa được bản nháp |

Admin ẩn hoặc bỏ ẩn tin ở bất kỳ trạng thái nào, ẩn thì phải kèm lý do. Recruiter nhận thông báo `JOB_HIDDEN`.

- Thiếu điều kiện đăng (bản `vi`, hạn ở tương lai, ít nhất 1 kỹ năng) thì 400 `JOB_INVALID_TRANSITION`, `details` liệt kê từng điều kiện còn thiếu (đã dịch theo ngôn ngữ). Công ty chưa duyệt thì 403 `COMPANY_NOT_APPROVED`. Hàm thuần `jobPublishBlockers` và bảng `JOB_TRANSITIONS` nằm trong `packages/shared` để frontend dùng lại.
- Sửa tin đang PUBLISHED cũng phải giữ đủ điều kiện đăng (không đặt hạn đã qua, không bỏ hết kỹ năng).
- Mở lại giữ `publishedAt` của lần đăng đầu, xóa `closedAt`. Đổi trạng thái dùng `UPDATE ... WHERE status = <trạng thái cũ>` nên bấm hai lần cùng lúc thì lần sau nhận 400.

Tin được coi là công khai (hàm `isJobPublic(job, company, now)`) khi đủ 4 điều kiện: PUBLISHED, không bị ẩn, công ty APPROVED, `expiresAt > now`.

API chi tiết tin công khai trả về theo 3 trường hợp:

| Trường hợp | Trả về | Frontend làm gì |
| --- | --- | --- |
| Tin công khai | 200, `seo.indexable: true`, `isAcceptingApplications: true` | Index bình thường |
| CLOSED hoặc hết hạn, không bị ẩn | 200, `seo.indexable: false`, `isAcceptingApplications: false` | Đặt `noindex`, ẩn nút ứng tuyển |
| DRAFT, bị ẩn, hoặc công ty chưa duyệt | 404 | `notFound()` |

### 5.3 Ứng tuyển

Khi nộp đơn, server kiểm lần lượt:

1. Người gọi là CANDIDATE, nếu không trả 403.
2. Tin tồn tại và công khai, nếu không trả 404. Tin đã đóng hoặc hết hạn trả 400 `JOB_NOT_ACCEPTING`.
3. Hồ sơ đã xong các bước BASIC, EDUCATION, SKILLS, nếu chưa trả 400 `PROFILE_INCOMPLETE`. Bước PROJECTS không bắt buộc.
4. `cvFileId` thuộc ứng viên này và chưa bị xóa, nếu không trả 400 `CV_INVALID`.
5. Chưa từng nộp vào tin này, nếu đã nộp trả 409 `APPLICATION_DUPLICATE`. Kiểm bằng ràng buộc unique trong DB (bắt `QueryFailedError` có mã Postgres `23505`), không chỉ bằng câu SELECT trước, để chặn cả trường hợp bấm hai lần cùng lúc.

Trong cùng một transaction, server tạo đơn kèm `profileSnapshot` (hồ sơ tại thời điểm nộp), ghi một dòng lịch sử (null sang SUBMITTED), và tạo thông báo `NEW_APPLICATION` cho recruiter. Đơn đã rút thì không nộp lại vào cùng tin đó được.

### 5.4 Trạng thái hồ sơ ứng tuyển

| Từ | Recruiter được chuyển sang | Candidate được chuyển sang |
| --- | --- | --- |
| SUBMITTED | REVIEWING, FAILED | WITHDRAWN |
| REVIEWING | INTERVIEW, FAILED | WITHDRAWN |
| INTERVIEW | PASSED, FAILED | WITHDRAWN |
| PASSED, FAILED, WITHDRAWN | (kết thúc) | (kết thúc) |

- Khai báo bảng chuyển dạng `Record<ApplicationStatus, Partial<Record<Actor, readonly ApplicationStatus[]>>>`, kèm hàm thuần `canTransition(from, to, actor)` và type guard `isApplicationStatus`.
- Chuyển sai trả 400 `APPLICATION_INVALID_TRANSITION`.
- Chống hai người cùng đổi một lúc: cập nhật có điều kiện bằng `repo.update({ id, status: from }, { status: to })`. Nếu `result.affected` bằng 0 thì trả 409 `APPLICATION_STATUS_CONFLICT`.
- Mỗi lần chuyển: ghi lịch sử (ai, lúc nào, ghi chú tùy chọn) và gửi thông báo `APPLICATION_STATUS_CHANGED` cho bên còn lại, tất cả trong một transaction.

### 5.5 CV

- Chỉ nhận PDF, kiểm tra ở server cả 3 thứ: MIME type, đuôi `.pdf`, và 5 byte đầu phải là `%PDF-`. Sai thì trả 400 `FILE_INVALID_TYPE`.
- Tối đa 5 MB, đặt qua `limits.fileSize` của Multer. Vượt thì trả 400 `FILE_TOO_LARGE`; lỗi này phải đi qua Exception Filter để đúng format chung.
- Mỗi ứng viên tối đa 5 CV chưa xóa (CV đã xóa mềm không tính), vượt thì trả 400 CV\_LIMIT\_REACHED. CV đầu tiên tự thành mặc định; xóa CV mặc định thì CV mới nhất còn lại thành mặc định.
- Upload lên Cloudinary bằng `upload_stream` từ buffer, với `resource_type: 'raw'`, `type: 'authenticated'`, `folder: 'cvs/<candidateId>'`, `public_id` là uuid ngẫu nhiên. DB chỉ lưu `cloudinaryPublicId`, không lưu URL công khai vì CV không có URL công khai.
- Tải về: `GET /files/cvs/:id` kiểm quyền theo mục 2, rồi trả `{ url, expiresAt }` với `url` sinh bằng `cloudinary.utils.private_download_url` hết hạn sau 60 giây.
- Xóa CV là xóa mềm trong DB, file trên Cloudinary giữ lại. CV đã gắn vào đơn thì nhà tuyển dụng vẫn tải được.
- Ảnh logo và avatar: `type: 'upload'` (công khai), chỉ nhận jpg/png/webp tối đa 2 MB, resize khi upload. Lưu `secure_url` và `publicId`; đổi ảnh thì xóa ảnh cũ trên Cloudinary.
- **Việc phải làm khi tạo tài khoản Cloudinary:** gói miễn phí mặc định chặn giao file PDF và ZIP. Vào Settings → Security bật "Allow delivery of PDF and ZIP files", nếu không link tải CV sẽ lỗi.
- Mọi thao tác Cloudinary đi qua một `CloudinaryService` duy nhất ở `src/infrastructure/cloudinary/`, các module khác không gọi SDK trực tiếp. Trong test thì mock service này.

### 5.6 Hồ sơ nhiều bước

- 4 bước, mỗi bước một endpoint `PUT`, validate bằng schema riêng của bước đó. Frontend import cùng schema từ `packages/shared`.
- Lưu thành công thì thêm bước vào `completedSteps`. Response kèm `completion: { steps, percent }`.
- Lưu nháp giữa các bước là việc của frontend (Zustand persist). Backend chỉ lưu khi người dùng bấm "Tiếp".

### 5.7 Gợi ý việc theo kỹ năng (nâng cao)

- Hàm thuần `matchScore(candidateSkillIds, jobSkills)`: kỹ năng bắt buộc có trọng số 2, kỹ năng ưu tiên trọng số 1. Điểm bằng tổng trọng số khớp chia tổng trọng số của tin, quy ra thang 0–100.
- `GET /me/recommended-jobs` lấy các tin công khai có ít nhất 1 kỹ năng trùng và bỏ tin đã nộp, sắp xếp theo điểm giảm dần, trả top 20 kèm `matchScore` và `matchedSkills`.
- Chi tiết tin cũng trả `matchScore` khi người xem là candidate.

### 5.8 Thông báo (nâng cao)

- Notification được tạo trong cùng transaction với hành động sinh ra nó.
- Frontend polling `GET /me/notifications/unread-count` mỗi 30 giây. Muốn điểm cao hơn thì thêm SSE `GET /me/notifications/stream`.
- Email (tùy chọn): gửi khi đơn chuyển sang INTERVIEW, PASSED hoặc FAILED, dùng template theo `preferredLocale`. Chạy nền, không chặn request.

### 5.9 Thống kê

- **Admin:** số tin theo trạng thái, số đơn theo trạng thái, số đơn theo ngày trong 30 ngày gần nhất, top 5 công ty nhận nhiều đơn nhất, số công ty đang chờ duyệt.
- **Recruiter:** với mỗi tin của công ty mình, số đơn theo từng trạng thái.

## 6. Xác thực

NestJS cấp JWT; Auth.js giữ token đó trong session của nó. Mọi request từ Next sang NestJS đều gửi `Authorization: Bearer <token>`. Nhờ vậy đề vẫn dùng Auth.js (Credentials + Google) như yêu cầu, còn quyền thật nằm ở NestJS.

**Luồng Credentials:**

1. Provider Credentials của Auth.js gọi `POST /auth/login { email, password }` trong `authorize()`.
2. NestJS kiểm mật khẩu (argon2) và trạng thái ACTIVE, rồi trả `{ accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, user: { id, email, name, role, companyId, preferredLocale } }`.
3. Callback `jwt` của Auth.js lưu `accessToken` và `role`, callback `session` đưa chúng ra `session`. Phía frontend augment kiểu trong `next-auth.d.ts`.

**Luồng Google:**

1. Provider Google của Auth.js lấy `account.id_token`, gọi `POST /auth/oauth/google { idToken }`.
2. NestJS verify id\_token bằng `google-auth-library` với audience là `GOOGLE_CLIENT_ID`, lấy ra `sub`, `email`, `email_verified`. Không tin email do client tự gửi.
3. Xử lý tài khoản theo 3 trường hợp:
   - Đã có Account (google, sub): đăng nhập user đó.
   - Chưa có Account nhưng email đã xác minh trùng với một user có sẵn: liên kết vào user đó.
   - Chưa có gì: tạo user mới với role CANDIDATE.
   - Email Google chưa xác minh (và chưa có Account): trả 400 `AUTH_GOOGLE_EMAIL_UNVERIFIED`, không liên kết, không tạo user.
4. Trả về cùng format với `/auth/login`.

Recruiter chỉ đăng ký được qua form, vì cần nhập thông tin công ty. Sau đó có thể đăng nhập bằng Google nhờ liên kết theo email. Hệ thống chỉ có đúng 1 admin, tạo qua seed; không có API nào tạo admin hay đổi role của user thành ADMIN.

**Access token, refresh token và bảo vệ:**

- **Access token:** JWT ký bằng `JWT_ACCESS_SECRET`, payload `{ sub, role }`, sống **15 phút**.
- **Refresh token:** chuỗi ngẫu nhiên 64 byte (không phải JWT), sống **7 ngày**. DB chỉ lưu hash SHA-256 trong bảng `RefreshToken`, kèm `familyId` để biết các token cùng một phiên đăng nhập.
- `/auth/login`, `/auth/oauth/google` và `/auth/refresh` đều trả `{ accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, user }`.
- **Xoay vòng:** mỗi lần gọi `POST /auth/refresh`, token cũ bị thu hồi (`revokedAt`, `replacedById`) và cấp cặp token mới cùng `familyId`.
- **Phát hiện dùng lại:** nếu một refresh token đã bị thu hồi mà vẫn được gửi lên, thu hồi toàn bộ family đó và trả 401 `AUTH_REFRESH_REUSED`; người dùng phải đăng nhập lại.
- **Khoảng ân hạn 30 giây:** Next có thể gửi hai request refresh gần như cùng lúc. Token vừa bị xoay trong vòng 30 giây được coi là hợp lệ và cấp cặp mới cùng family, không bị tính là dùng lại. Đây là đánh đổi có chủ ý: trong 30 giây đó phiên có thể tạm có hai nhánh token hợp lệ, đổi lại Next gửi hai request refresh cùng lúc không bị đăng xuất.
- **Phía Auth.js** (nhóm frontend làm theo hợp đồng này):
  - Callback `jwt` lưu cả hai token và hai mốc hết hạn.
  - Khi access token còn dưới 60 giây, gọi `/auth/refresh` rồi cập nhật token.
  - Refresh thất bại thì gắn `error: 'RefreshTokenError'` vào session để giao diện buộc đăng nhập lại.
  - `maxAge` của session là 7 ngày, khớp với refresh token.
- **Thu hồi:** `/auth/logout` thu hồi family hiện tại, `/auth/logout-all` thu hồi mọi family của user. Đổi mật khẩu hoặc bị admin khóa cũng thu hồi toàn bộ.
- Cron hằng ngày xóa refresh token đã hết hạn quá 7 ngày.
- `JwtStrategy.validate()` luôn đọc user từ DB: user không còn thì 401, bị khóa thì 403. Role lấy từ DB chứ không lấy từ payload. Token có iat trước passwordChangedAt cũng trả 401 AUTH\_TOKEN\_INVALID, nên đổi mật khẩu vô hiệu ngay access token cũ.
- Đăng ký: `POST /auth/register/candidate` và `POST /auth/register/recruiter` (kèm thông tin công ty). Email trùng trả 409 `AUTH_EMAIL_TAKEN`.
- Mật khẩu tối thiểu 8 ký tự, có cả chữ và số, băm bằng argon2id.
- Giới hạn tần suất cho `/auth/login`, `/auth/register/*`, `/auth/refresh` và `/auth/oauth/google`, vượt thì trả 429 `TOO_MANY_REQUESTS` kèm header `Retry-After`. Hai lớp: theo IP cho từng route (`RATE_LIMIT_AUTH_PER_MINUTE`, mặc định 30/phút) và riêng đăng nhập theo email (`RATE_LIMIT_LOGIN_PER_EMAIL`, mặc định 10 lần/15 phút). Lớp theo email cần thiết vì Auth.js gọi `/auth/login` từ server Next, mọi người dùng có thể chung một IP.
- Mã lỗi: 400 `AUTH_GOOGLE_EMAIL_UNVERIFIED`, 401 `AUTH_INVALID_CREDENTIALS`, 401 `AUTH_TOKEN_INVALID`, 401 `AUTH_REFRESH_INVALID`, 401 `AUTH_REFRESH_REUSED`, 401 `AUTH_GOOGLE_TOKEN_INVALID`, 403 `AUTH_ACCOUNT_LOCKED`.

## 7. Danh sách API

Khoảng 55 endpoint, prefix chung `/api/v1`. API công khai nhận `?lang=vi|en`. API danh sách nhận `page`, `limit` (tối đa 50) và trả `{ data: T[], meta: { page, limit, total, totalPages } }`.

### Auth và danh mục

| Method | Path | Quyền | Ghi chú |
| --- | --- | --- | --- |
| POST | /auth/register/candidate | Guest |  |
| POST | /auth/register/recruiter | Guest | Tạo luôn công ty PENDING |
| POST | /auth/login | Guest | Có rate limit |
| POST | /auth/oauth/google | Guest | Body `{ idToken }` |
| POST | /auth/refresh | Guest (gửi kèm refresh token) | Body { refreshToken }; xoay vòng token, có rate limit |
| POST | /auth/logout | Đã đăng nhập | Body { refreshToken }; thu hồi phiên hiện tại |
| POST | /auth/logout-all | Đã đăng nhập | Thu hồi mọi refresh token của user |
| GET | /auth/me | Đã đăng nhập |  |
| PATCH | /auth/me | Đã đăng nhập | name, preferredLocale (avatar đổi qua endpoint upload riêng) |
| POST | /auth/me/avatar | Đã đăng nhập | Multipart, field file; jpg/png/webp tối đa 2 MB; lưu lên Cloudinary, xóa ảnh cũ, trả avatarUrl |
| PATCH | /auth/me/password | Đã đăng nhập |  |
| GET | /meta/skills, /meta/locations, /meta/industries | Guest | Trả `name` theo lang, cache lâu |

### Tin tuyển và công ty (công khai)

| Method | Path | Quyền | Ghi chú |
| --- | --- | --- | --- |
| GET | /jobs | Guest | Lọc theo `q`, `skills` (`?skills=a&skills=b`, `?skills=a,b` hoặc `?skills[]=a`; khớp khi tin có ít nhất một kỹ năng), `locationId`, `workMode`, `isPaid`; sắp xếp `newest`, `deadline` hoặc `relevance` (mặc định khi có `q`, theo `similarity` của pg_trgm) |
| GET | /jobs/:slug | Guest | Không có bản dịch theo lang thì 404; trả canonicalSlug để redirect khi slug lệch. Token không bắt buộc; có token candidate thì kèm `matchScore`, `isSaved`, `hasApplied` |
| GET | /me/recommended-jobs | Candidate | Nâng cao, top 20 theo độ khớp |
| GET | /companies | Guest |  |
| GET | /companies/:slug | Guest | Chỉ công ty APPROVED |
| GET | /companies/:slug/jobs | Guest |  |

### Ứng viên

| Method | Path | Quyền | Ghi chú |
| --- | --- | --- | --- |
| GET | /me/profile | Candidate | Kèm `completion` |
| PUT | /me/profile/basic, /education, /skills, /projects | Candidate | Mỗi bước một schema |
| GET, POST | /me/cvs | Candidate | POST dạng multipart, field `file` |
| PATCH | /me/cvs/:id/default | Candidate |  |
| DELETE | /me/cvs/:id | Candidate | Xóa mềm |
| GET | /me/saved-jobs | Candidate |  |
| PUT, DELETE | /me/saved-jobs/:jobId | Candidate | Idempotent |
| POST | /jobs/:jobId/applications | Candidate | Body `{ cvFileId, coverLetter? }` |
| GET | /me/applications, /me/applications/:id | Candidate | Kèm lịch sử trạng thái, không có ghi chú nội bộ |
| POST | /me/applications/:id/withdraw | Candidate |  |
| GET | /files/cvs/:id | Candidate chủ CV, Recruiter liên quan | Kiểm quyền rồi trả { url, expiresAt }: signed URL Cloudinary sống 60 giây |

### Nhà tuyển dụng

| Method | Path | Quyền | Ghi chú |
| --- | --- | --- | --- |
| GET, PUT | /recruiter/company | Recruiter | PUT gửi bản `vi` (bắt buộc) và `en`; công ty bị từ chối thì PUT đưa về PENDING |
| POST | /recruiter/company/logo | Recruiter | Ảnh tối đa 2 MB, logo là công khai |
| GET, POST | /recruiter/jobs | Recruiter |  |
| GET, PATCH, DELETE | /recruiter/jobs/:id | Recruiter công ty sở hữu | DELETE chỉ cho DRAFT |
| POST | /recruiter/jobs/:id/publish, /close, /reopen | Recruiter công ty sở hữu | Theo bảng 5.2 |
| GET | /recruiter/jobs/:id/applications | Recruiter công ty sở hữu | Lọc theo `status`, phân trang |
| GET | /recruiter/applications/:id | Recruiter công ty sở hữu | Snapshot hồ sơ, CV, lịch sử, ghi chú |
| PATCH | /recruiter/applications/:id/status | Recruiter công ty sở hữu | Body `{ to, note? }`, theo bảng 5.4 |
| GET, POST | /recruiter/applications/:id/notes | Recruiter công ty sở hữu |  |
| PATCH, DELETE | /recruiter/notes/:noteId | Tác giả ghi chú |  |
| GET | /recruiter/stats | Recruiter |  |

### Thông báo (mọi vai trò đã đăng nhập)

| Method | Path | Ghi chú |
| --- | --- | --- |
| GET | /me/notifications | Tiêu đề và nội dung dịch theo `preferredLocale` |
| GET | /me/notifications/unread-count | Dùng cho polling |
| PATCH | /me/notifications/:id/read |  |
| POST | /me/notifications/read-all |  |
| GET | /me/notifications/stream | SSE, tùy chọn |

### Admin

| Method | Path | Ghi chú |
| --- | --- | --- |
| GET | /admin/companies | Lọc theo `status` |
| PATCH | /admin/companies/:id/approve |  |
| PATCH | /admin/companies/:id/reject | Body `{ reason }` |
| GET | /admin/jobs | Lọc theo `q`, `status`, `hidden` |
| PATCH | /admin/jobs/:id/hide, /unhide | hide cần `{ reason }` |
| GET | /admin/users | Lọc theo `role`, `status`, `q` |
| PATCH | /admin/users/:id/lock, /unlock | Không khóa được chính mình (400 CANNOT\_LOCK\_SELF); hệ thống chỉ có 1 admin |
| GET | /admin/stats | `?days=30` |

### SEO và hệ thống

| Method | Path | Ghi chú |
| --- | --- | --- |
| GET | /seo/sitemap | Tin và công ty công khai, slug theo từng ngôn ngữ, `updatedAt` |
| GET | /seo/static-params | Tham số type (job hoặc company) và limit (mặc định 100), dùng cho generateStaticParams |
| GET | /health | Kiểm tra kết nối DB |

## 8. Chuẩn kỹ thuật

Backend phải tự đủ các nhóm yêu cầu 1 (TypeScript), 6 (phân quyền) và 7 (Backend & API), đồng thời góp vào nhóm 4 (hiệu năng) và 5 (kiểm thử). Mỗi gạch dưới đây là thứ giảng viên sẽ tìm trong code.

### TypeScript (nhóm 1)

- `strict: true` và `noUncheckedIndexedAccess`. ESLint báo lỗi `no-explicit-any`; chỗ nào buộc phải dùng thì tắt rule trên dòng đó kèm lý do.
- Generic tự viết: `Paginated<T>`, `ApiSuccess<T>`, hàm `paginate<T>()`, kiểu `WithTranslation<TBase, TTranslation>`.
- Utility type: DTO sửa sinh từ DTO tạo (`.partial()`, `.pick()`, `.omit()` của Zod tương ứng `Partial`, `Pick`, `Omit`); bảng chuyển trạng thái dùng `Record`.
- Type guard: `isApplicationStatus`, `isLocale`, `isPdfBuffer`.
- `packages/shared` export enum, schema Zod, kiểu response và hàm nghiệp vụ thuần (`canTransition`, `matchScore`, `isJobPublic`). Backend và frontend cùng import từ đây.

### Cấu trúc thư mục

Backend chia theo **module nghiệp vụ** (feature-based), tách riêng phần dùng chung (`common`) và phần tích hợp bên ngoài (`infrastructure`). Thêm một tính năng mới chỉ cần thêm một thư mục trong `modules/`, không phải sửa rải rác.

```text
apps/api/
├── CLAUDE.md                 luật cho Claude CLI (trỏ tới CONVENTIONS.md và spec)
├── CONVENTIONS.md            luật code backend cho người
├── CHANGELOG-API.md          ghi lại mọi thay đổi API đã bàn giao
├── README.md                 cài đặt, chạy, tài khoản demo, link Swagger, link deploy
├── Makefile                  lệnh tắt cho mọi việc (mục 10)
├── Dockerfile                build production nhiều stage, dùng cho Render
├── docker-compose.yml        PostgreSQL cho môi trường dev
├── .env.example
├── nest-cli.json, tsconfig.json, tsconfig.build.json
├── eslint.config.mjs, .prettierrc, jest.config.ts
├── test/
│   ├── e2e/                  *.e2e-spec.ts, mỗi module một file
│   └── utils/                tạo app test, tạo token, factory dữ liệu
└── src/
    ├── main.ts               bootstrap: helmet, CORS, prefix /api/v1, Swagger, global pipe/filter/interceptor
    ├── app.module.ts
    ├── config/               env.schema.ts (Zod), app/database/jwt/cloudinary.config.ts (registerAs)
    ├── database/
    │   ├── data-source.ts    dùng chung cho app và TypeORM CLI
    │   ├── migrations/
    │   └── seeds/            index.ts, factories/, data/ (kỹ năng, tỉnh/thành), assets/ (CV mẫu)
    ├── common/
    │   ├── constants/
    │   ├── decorators/       roles, public, current-user, lang
    │   ├── dto/              pagination-query.dto.ts
    │   ├── entities/         app-base.entity.ts
    │   ├── exceptions/       app.exception.ts, error-codes.ts
    │   ├── filters/          all-exceptions.filter.ts
    │   ├── guards/           jwt-auth, roles, optional-jwt
    │   ├── interceptors/     transform, logging
    │   ├── types/            paginated.ts, request-user.ts
    │   └── utils/            paginate.ts, slugify.ts, normalize-search.ts
    ├── infrastructure/       tích hợp bên ngoài, mỗi thứ một module
    │   ├── cloudinary/       upload, xóa, sinh signed URL
    │   ├── revalidate/       gọi webhook revalidate của Next
    │   └── mail/             tùy chọn
    ├── i18n/                 vi/*.json, en/*.json
    └── modules/
        ├── auth/   users/   companies/   jobs/   profiles/   cvs/
        └── applications/   notifications/   admin/   meta/   seo/   health/
```

Mọi module trong `modules/` có cùng bố cục. Ví dụ module `applications`:

```text
modules/applications/
├── applications.module.ts
├── controllers/
│   ├── candidate-applications.controller.ts    /jobs/:jobId/applications, /me/applications
│   └── recruiter-applications.controller.ts    /recruiter/applications
├── services/
│   ├── applications.service.ts                 nộp đơn, rút đơn, đọc đơn
│   ├── application-status.service.ts           chuyển trạng thái, lịch sử
│   └── application-notes.service.ts
├── repositories/
│   └── applications.repository.ts              query phức tạp (lọc, thống kê)
├── entities/
│   ├── application.entity.ts
│   ├── application-status-history.entity.ts
│   └── application-note.entity.ts
├── dto/                                        create-application, change-status, query-applications
├── mappers/
│   └── application.mapper.ts                   entity → response, ẩn ghi chú với candidate
├── guards/
│   └── application-access.guard.ts
└── *.spec.ts                                   test đặt cạnh file được test
```

| Lớp | Được làm | Không được làm |
| --- | --- | --- |
| Controller | Khai báo route, guard, decorator Swagger; nhận DTO; gọi service; trả kết quả của mapper | Chứa nghiệp vụ, gọi repository |
| Service | Nghiệp vụ, transaction, kiểm quyền sở hữu, ném `AppException`, phát event sau commit | Biết về `Request`/`Response` của HTTP |
| Repository | Query TypeORM phức tạp (QueryBuilder, tìm kiếm, thống kê) | Chứa quy tắc nghiệp vụ |
| Mapper | Đổi entity thành response, chọn bản dịch theo locale | Trả entity thô ra ngoài |
| Domain thuần (`packages/shared/src/domain`) | Hàm không phụ thuộc framework: `canTransition`, `matchScore`, `isJobPublic` | Import NestJS hay TypeORM |

Module chỉ ghi vào bảng của chính nó. Cần dữ liệu hoặc hành động của module khác thì gọi service mà module đó export.

### Validate và lỗi (nhóm 7)

- Dùng `ZodValidationPipe` global, mọi body, query, param đều có DTO. Query số dùng `z.coerce`.
- Mọi lỗi nghiệp vụ ném qua `AppException(code, params?, details?)`; HTTP status suy ra từ mã lỗi (bảng `ERROR_HTTP_STATUS`) nên không ném nhầm status. Pipe validate cũng ném `AppException` `VALIDATION_FAILED`. Filter tự map lỗi TypeORM: `QueryFailedError` mã `23505` (trùng unique) thành 409 `CONFLICT`, mã `23503` (vi phạm khóa ngoại) thành 400 `INVALID_REFERENCE`, `EntityNotFoundError` thành 404; lỗi HTTP có sẵn của Nest (route không tồn tại, JSON hỏng) quy về mã tương ứng.
- Response thành công là `{ data, meta? }`, do `TransformInterceptor` bọc.
- Response lỗi thống nhất, `message` được dịch theo locale:

```json
{
  "statusCode": 403,
  "code": "COMPANY_NOT_APPROVED",
  "message": "Công ty của bạn chưa được duyệt",
  "details": null,
  "path": "/api/v1/recruiter/jobs",
  "timestamp": "2026-11-08T14:00:00.000Z",
  "requestId": "b3f1c2"
}
```

Lỗi validate trả `details: [{ field, message }]`.

| Mã lỗi | HTTP | Khi nào |
| --- | --- | --- |
| VALIDATION\_FAILED | 400 | Body, query hoặc param sai |
| BAD\_REQUEST | 400 | Yêu cầu hỏng không qua validate (vd JSON sai cú pháp) |
| INVALID\_REFERENCE | 400 | Tham chiếu tới bản ghi không tồn tại (vi phạm khóa ngoại) |
| JOB\_NOT\_ACCEPTING | 400 | Ứng tuyển vào tin đã đóng hoặc hết hạn |
| PROFILE\_INCOMPLETE | 400 | Chưa xong các bước hồ sơ bắt buộc |
| CV\_INVALID | 400 | CV không thuộc ứng viên hoặc đã xóa |
| CV\_LIMIT\_REACHED | 400 | Đã có 5 CV |
| FILE\_INVALID\_TYPE | 400 | Sai loại file (CV không phải PDF, ảnh không phải JPG/PNG/WebP); tham số `allowed` |
| FILE\_TOO\_LARGE | 400 | Vượt 5 MB |
| JOB\_INVALID\_TRANSITION | 400 | Chuyển trạng thái tin sai bảng 5.2 |
| APPLICATION\_INVALID\_TRANSITION | 400 | Chuyển trạng thái đơn sai bảng 5.4 |
| CANNOT\_LOCK\_SELF | 400 | Admin tự khóa tài khoản của chính mình |
| AUTH\_PASSWORD\_INCORRECT | 400 | Đổi mật khẩu mà nhập sai mật khẩu hiện tại |
| AUTH\_GOOGLE\_EMAIL\_UNVERIFIED | 400 | Đăng nhập Google bằng email chưa xác minh (không liên kết, không tạo user) |
| AUTH\_INVALID\_CREDENTIALS | 401 | Sai email hoặc mật khẩu |
| AUTH\_TOKEN\_INVALID | 401 | Thiếu token, token sai hoặc hết hạn |
| AUTH\_REFRESH\_INVALID | 401 | Refresh token sai hoặc hết hạn |
| AUTH\_REFRESH\_REUSED | 401 | Refresh token đã thu hồi bị dùng lại; cả family bị thu hồi |
| AUTH\_GOOGLE\_TOKEN\_INVALID | 401 | `id_token` Google sai chữ ký, hết hạn hoặc sai audience |
| AUTH\_ACCOUNT\_LOCKED | 403 | Tài khoản bị khóa |
| FORBIDDEN | 403 | Sai vai trò hoặc không sở hữu tài nguyên |
| COMPANY\_NOT\_APPROVED | 403 | Công ty chưa duyệt mà tạo/đăng tin |
| NOT\_FOUND | 404 | Không tồn tại hoặc không được thấy |
| CONFLICT | 409 | Trùng dữ liệu unique không có mã riêng |
| AUTH\_EMAIL\_TAKEN | 409 | Email đã dùng |
| APPLICATION\_DUPLICATE | 409 | Đã nộp vào tin này |
| APPLICATION\_STATUS\_CONFLICT | 409 | Người khác vừa đổi trạng thái đơn |
| TOO\_MANY\_REQUESTS | 429 | Vượt giới hạn tần suất |
| INTERNAL\_ERROR | 500 | Lỗi không lường trước, không lộ stack trace |
| SERVICE\_UNAVAILABLE | 503 | `/health` không kết nối được database (Render coi là server lỗi) |

### Cấu trúc NestJS (nhóm 6 và 7)

- Mỗi module chia Module, Controller, Service. Repository được inject qua `@InjectRepository(Entity)` sau khi đăng ký bằng `TypeOrmModule.forFeature`; controller không gọi repository trực tiếp. Thao tác nhiều bảng chạy trong `dataSource.transaction()`.
- 2 Interceptor: `TransformInterceptor` bọc response, `LoggingInterceptor` ghi method, path, status, thời gian và requestId. Đề yêu cầu ít nhất 1.
- 1 Exception Filter: `AllExceptionsFilter` lo format lỗi, dịch message và map lỗi TypeORM.
- Guard:
  - `JwtAuthGuard` đặt global, route nào công khai thì gắn `@Public()`.
  - `RolesGuard` đi kèm decorator `@Roles()`.
  - `OptionalJwtGuard` cho `/jobs/:slug`.
  - Guard sở hữu `JobOwnershipGuard` và `ApplicationAccessGuard`: đọc id từ param rồi so `companyId` hoặc `candidateId`.
- Service kiểm quyền sở hữu thêm một lần nữa (truyền `userId` vào mọi hàm), nên ngay trong backend đã có 2 lớp bảo vệ.
- Decorator tự viết: `@CurrentUser()`, `@Lang()`, `@Roles()`, `@Public()`.

### Bảo mật, cấu hình, hiệu năng

- Bật `helmet` (trang Swagger tắt CSP để giao diện chạy được), CORS chỉ cho domain frontend (`FRONTEND_URL`), giới hạn kích thước body (mặc định 100 KB của Express). Production bật `trust proxy` 1 hop vì Render đặt API sau proxy.
- Validate biến môi trường bằng Zod lúc khởi động: thiếu biến thì app không chạy.
- Swagger ở `/api/docs` (file `/api/docs/openapi.json`) có Bearer auth, mỗi module một tag, response mô tả đúng dạng `{ data }` qua `@ApiDataResponse` và lỗi qua `@ApiErrorResponses`.
- Mọi danh sách đều phân trang bằng `skip`/`take` và `findAndCount`. Chỉ `select` trường cần, nạp quan hệ bằng `relations` hoặc `leftJoinAndSelect` thay vì query trong vòng lặp, để tránh N+1.
- `/meta/*` gửi `Cache-Control` 1 ngày.

`.env.example` của backend gồm các biến sau. `.env` thật không bao giờ được commit.

| Nhóm | Biến |
| --- | --- |
| App | `NODE_ENV`, `PORT`, `FRONTEND_URL` |
| Database | `DATABASE_URL` (chuỗi pooled của Neon, app dùng), `DATABASE_DIRECT_URL` (chuỗi direct của Neon, chỉ migration dùng), `DB_SSL` (bật khi kết nối Neon) |
| Docker dev | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN` (15m), `REFRESH_TOKEN_EXPIRES_IN` (7d), `REFRESH_TOKEN_GRACE_SECONDS` (30), `GOOGLE_CLIENT_ID` |
| Giới hạn tần suất | `RATE_LIMIT_AUTH_PER_MINUTE` (30), `RATE_LIMIT_LOGIN_PER_EMAIL` (10) |
| Seed | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (chỉ `make seed` dùng) |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Revalidate | `REVALIDATE_URL`, `REVALIDATE_SECRET` |
| Mail (tùy chọn) | `MAIL_HOST`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` |

### Luật code backend

Luật nằm trong 2 file. `apps/api/CONVENTIONS.md` là bản đầy đủ cho người đọc. `apps/api/CLAUDE.md` ngắn, để Claude CLI đọc tự động: nó trỏ tới CONVENTIONS.md và tài liệu này, kèm các lệnh make cần chạy. Nội dung luật:

**Đặt tên và file**

- Tên file kebab-case theo mẫu `<tên>.<loại>.ts`: `job.entity.ts`, `create-job.dto.ts`, `jobs.service.ts`, `roles.guard.ts`.
- Class PascalCase, biến và hàm camelCase, hằng số và giá trị enum UPPER\_SNAKE\_CASE.
- Bảng và cột trong DB dùng snake\_case qua `SnakeNamingStrategy` (gói `typeorm-naming-strategies`); tên bảng số nhiều, ví dụ `job_translations`.
- Mỗi file một class. File vượt khoảng 300 dòng thì tách.

**Phân lớp:** theo bảng ở mục "Cấu trúc thư mục". Controller không chứa nghiệp vụ, service không biết HTTP, không bao giờ trả entity thô.

**TypeScript**

- Không `any`; bắt buộc phải dùng thì tắt rule trên đúng dòng đó và ghi lý do.
- Không dùng non-null assertion `!` nếu không có comment giải thích.
- Method public của service khai báo kiểu trả về rõ ràng.
- Enum, schema và kiểu dùng chung lấy từ `packages/shared`, không định nghĩa lại trong `apps/api`.

**Database**

- Mọi thay đổi schema tạo migration bằng `make migration-generate name=<TênMôTả>`. Không sửa migration đã merge vào `main`.
- Thao tác ghi nhiều bảng chạy trong `dataSource.transaction()`.
- Việc phụ sau khi ghi (revalidate, email) phát event và chỉ chạy sau khi transaction commit.

**Lỗi và i18n**

- Chỉ ném `AppException` với mã có trong `error-codes.ts`.
- Thêm mã lỗi mới thì thêm bản dịch vào cả `i18n/vi` và `i18n/en`.
- Không hardcode chuỗi người dùng nhìn thấy.

**API**

- Route, quyền và mã lỗi theo mục 2, 7 và 8 của tài liệu này.
- Mọi input có DTO. Mọi endpoint có decorator Swagger (`@ApiTags`, `@ApiOkResponse`, `@ApiBearerAuth` khi cần).
- Đổi API đã bàn giao thì ghi `CHANGELOG-API.md`.

**Bảo mật**

- Không log mật khẩu, token, secret.
- Kiểm quyền hai lớp: Guard và kiểm lại trong service.
- Secret chỉ đọc từ biến môi trường qua `ConfigService`, không đọc `process.env` rải rác.

**Test và Git**

- Hàm thuần và service mới phải có file `*.spec.ts` đặt cạnh.
- `make check` (lint, typecheck, test) phải xanh trước khi push.
- Commit theo Conventional Commits với scope `api` hoặc `shared`; mỗi commit một việc.

**Riêng cho Claude CLI** (ghi trong `CLAUDE.md`)

- Đọc `docs/SPEC-BACKEND.md` và `CONVENTIONS.md` trước khi làm.
- Chỉ sửa `apps/api` và `packages/shared`, không động vào `apps/web`.
- Không cài thêm thư viện ngoài stack ở mục 1 khi chưa hỏi.
- Chạy `make check` sau mỗi thay đổi và sửa đến khi xanh.
- Làm theo thứ tự ở mục 12; xong mỗi bước thì commit.

## 9. Hỗ trợ SEO và render cho frontend

Backend phải cấp đủ dữ liệu và tín hiệu để frontend làm được 4 việc: SSG/ISR/SSR đúng từng trang, JSON-LD JobPosting hợp lệ, sitemap chỉ gồm tin còn hạn, và hreflang. Không có phần này thì nhóm frontend không thể đạt yêu cầu riêng của đề.

### Bảng render và nguồn dữ liệu

| Trang | Chiến lược | Endpoint backend | Cache tag |
| --- | --- | --- | --- |
| Trang chủ | SSG, làm mới theo tag | /jobs?sort=newest&limit=8, /meta/\* | `jobs:list` |
| Chi tiết tin | ISR, `generateStaticParams` + `revalidate` 3600 giây | /seo/static-params, /jobs/:slug | `job:{id}` |
| Trang công ty | ISR | /companies/:slug, /companies/:slug/jobs | `company:{id}` |
| Kết quả tìm kiếm | SSR, không cache | /jobs với bộ lọc |  |
| Dashboard ứng viên, nhà tuyển dụng, admin | Động theo phiên, không cache, gửi kèm token | `/me/*`, `/recruiter/*`, `/admin/*` |  |
| sitemap.xml | Động, làm mới theo tag | /seo/sitemap | `sitemap` |

### Dữ liệu cho JSON-LD JobPosting

`GET /jobs/:slug` trả đủ trường để dựng JobPosting qua Rich Results Test. Hàm dựng `buildJobPostingJsonLd(job, locale)` đặt trong `packages/shared`, có unit test, và frontend chỉ việc gọi.

| Thuộc tính JSON-LD | Lấy từ |
| --- | --- |
| title, description | Bản dịch theo locale; backend trả thêm `descriptionHtml` (cả `requirementsHtml`, `benefitsHtml`) render từ Markdown bằng markdown-it với HTML thô bị tắt, link `javascript:` bị chặn, không nhận ảnh |
| datePosted, validThrough | `publishedAt`, `expiresAt` (ISO 8601) |
| employmentType | Cố định `INTERN` |
| identifier | `shortId` |
| hiringOrganization | Tên công ty, `website` làm sameAs, URL logo tuyệt đối |
| jobLocation | Địa chỉ, tỉnh/thành, `addressCountry: VN`; bỏ qua nếu REMOTE |
| jobLocationType, applicantLocationRequirements | Khi REMOTE: `TELECOMMUTE` và quốc gia Việt Nam |
| baseSalary | Khi `isPaid`: VND, `minValue`, `maxValue`, đơn vị MONTH |
| directApply | `true` |

Cùng response đó cũng đủ cho `opengraph-image.tsx`: tiêu đề, tên công ty, logo, địa điểm, hình thức làm việc, có lương hay không.

### Webhook revalidate

Mọi thay đổi dữ liệu công khai đều làm backend gọi `POST REVALIDATE_URL` (một Route Handler bên Next), kèm header `x-revalidate-secret` và body `{ tags: string[] }`. Dùng webhook làm nguồn chính vì có những thay đổi phát sinh ngay trong backend, như admin ẩn tin hay cron đóng tin, mà Server Action không biết.

| Sự kiện | Tags cần làm mới |
| --- | --- |
| Đăng, sửa, đóng, mở lại tin | `job:{id}`, `jobs:list`, `company:{companyId}`, `sitemap` |
| Admin ẩn hoặc bỏ ẩn tin | Giống dòng trên |
| Cron đóng tin hết hạn | `job:{id}` cho từng tin, `jobs:list`, `sitemap` |
| Sửa trang công ty, admin duyệt công ty | `company:{id}`, `jobs:list`, `sitemap` |

Webhook gửi sau khi transaction đã commit, không chặn response, thử lại 3 lần; thất bại thì chỉ ghi log.

### Sitemap, hreflang, canonical

- `/seo/sitemap` trả mảng `{ type: 'job' | 'company', updatedAt, alternates: { locale, slug }[] }`. Chỉ gồm tin đang công khai, còn hạn, và công ty APPROVED.
- Frontend sinh mỗi URL cho từng locale có bản dịch, kèm `alternates.languages` và `x-default` trỏ về bản `vi`.
- Canonical của mỗi trang trỏ về chính URL của nó theo ngôn ngữ. Không phát sinh URL `en` cho tin chưa có bản `en`, vì `alternates` chỉ liệt kê ngôn ngữ đã có.

## 10. Môi trường dev, seed, kiểm thử, triển khai

### Seed dữ liệu

Lệnh `make seed` chạy script TypeORM trong `src/database/seeds/`, dùng chung `data-source.ts` với app. Script chạy lại được nhiều lần: dữ liệu demo xóa sạch rồi tạo lại; danh mục (kỹ năng, ngành, tỉnh/thành) thì upsert theo `slug`/`code` để id không đổi; admin lấy email và mật khẩu từ `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` và chỉ cập nhật chính tài khoản admin có sẵn (DB có index `uq_users_single_admin` chặn admin thứ hai). Dùng `@faker-js/faker` với seed cố định để lần nào dữ liệu cũng giống nhau. Mật khẩu demo dùng chung và ghi trong README.

| Dữ liệu | Số lượng | Ghi chú |
| --- | --- | --- |
| Admin | 1 | `admin@demo.vn` |
| Công ty và recruiter | 12 công ty: 8 APPROVED, 3 PENDING, 1 REJECTED | Demo `recruiter@demo.vn` (công ty đã duyệt) và `recruiter.pending@demo.vn` |
| Ứng viên | 300 | `candidate@demo.vn` có hồ sơ đầy đủ và 2 CV; `candidate.new@demo.vn` hồ sơ trống để demo lỗi `PROFILE_INCOMPLETE` |
| Tin tuyển | 300 | Khoảng 70% có bản `en`; có đủ nháp, đang đăng, đã đóng, hết hạn, bị ẩn |
| Đơn ứng tuyển | Trên 600 | Đủ 6 trạng thái, có lịch sử và ghi chú. Một tin của `recruiter@demo.vn` có trên 250 đơn để demo danh sách dài |
| Kỹ năng | Khoảng 60 | Song ngữ |
| Tỉnh/thành | 34 | Song ngữ |
| CV mẫu | Vài file PDF nhỏ | Đặt trong `src/database/seeds/assets/`, upload lên Cloudinary (folder `seed/`) với `public_id` cố định và `overwrite`, nên chạy seed lại không sinh file rác |

### Kiểm thử backend

Đề yêu cầu tối thiểu 15 test cho cả dự án và coverage 50% ở thư mục logic chính. Backend tự đặt mục tiêu từ 40 test trở lên, coverage từ 70% ở `packages/shared/src/domain` và các file `*.service.ts`. Test component bằng React Testing Library vẫn là việc của nhóm frontend.

| Loại | Nội dung tối thiểu |
| --- | --- |
| Unit hàm thuần | `canTransition` cho mọi cặp trạng thái và actor; `matchScore` (không có kỹ năng, khớp hết, chỉ khớp kỹ năng ưu tiên); `isJobPublic` ở biên `expiresAt` = now; `isPdfBuffer`; `buildJobPostingJsonLd` (REMOTE và ONSITE, có và không lương); hàm tạo slug tiếng Việt |
| Service, mock repository | `ApplicationsService.apply`: 5 nhánh lỗi và nhánh thành công; `changeStatus`: sai công ty, chuyển sai, xung đột; `JobsService.publish` khi công ty chưa duyệt; `CvsService` với file quá 5 MB và file không phải PDF |
| E2E (supertest, DB test riêng) | Không token trả 401; candidate gọi API recruiter trả 403; recruiter công ty A xem đơn công ty B trả 404; body sai trả 400 đúng format; tải CV người khác trả 404 |
| Đồng thời | Hai request nộp đơn chạy cùng lúc bằng `Promise.all`: một cái 201, một cái 409 |

Mock repository bằng `getRepositoryToken(Entity)` trong `Test.createTestingModule`. Chạy `jest --coverage` và chụp báo cáo coverage đưa vào báo cáo mục e.

### Docker và xem dữ liệu

Docker chỉ lo database khi dev; API chạy trực tiếp trên máy bằng `make dev` để có hot reload.

- **postgres:** image `postgres:16-alpine`, cổng 5435 trên máy (biến `POSTGRES_PORT`, vì 5432–5434 đã có Postgres khác trên máy dùng) chỉ bind 127.0.0.1, volume `pgdata` để dữ liệu không mất khi tắt container, healthcheck bằng `pg_isready`.
- Xem dữ liệu bằng pgAdmin cài trên máy: Register → Server, host `localhost`, cổng `5435`, user/mật khẩu/database theo `.env`. `make db-info` in sẵn các thông số này.
- API trên máy kết nối qua `DATABASE_URL=postgresql://<user>:<pass>@localhost:5435/<db>`.
- Extension `pg_trgm` và `unaccent` tạo trong migration đầu tiên bằng `CREATE EXTENSION IF NOT EXISTS`, để local và Render giống nhau.

### Makefile

Gõ `make` không tham số sẽ in danh sách lệnh. Makefile chỉ là lối tắt: mỗi target gọi lại một npm script, docker compose hoặc script Node (scripts/\*.mjs), không dùng cp, rm hay cú pháp riêng của sh, để chạy được cả trên cmd lẫn Git Bash; logic nằm trong package.json nên không có make vẫn chạy được bằng npm. Trên Windows cần có `make` (qua Git Bash, WSL hoặc `choco install make`).

| Lệnh | Việc làm |
| --- | --- |
| `make setup` | Lần đầu: cài dependency, tạo `.env` từ `.env.example` nếu chưa có, bật Docker, chạy migration, seed |
| `make up` / `make down` | Bật / tắt Postgres (giữ dữ liệu) |
| `make logs` | Xem log container |
| `make dev` | Chạy API ở chế độ watch |
| `make build` / `make start` | Build và chạy bản production trên máy |
| `make lint` / `make format` / `make typecheck` | Kiểm tra và định dạng code |
| `make test` / `make test-watch` / `make test-cov` / `make test-e2e` | Chạy test |
| `make check` | lint + typecheck + test; bắt buộc xanh trước khi push |
| `make migration-generate name=AddJobIndex` | Sinh migration từ thay đổi entity |
| `make migration-create name=CreateExtensions` | Tạo migration rỗng để viết SQL tay |
| `make migrate` / `make migrate-revert` | Chạy / lùi migration |
| `make seed` | Seed dữ liệu demo |
| `make db-reset` | Xóa volume, bật lại DB, migrate, seed |
| `make db-shell` | Mở `psql` trong container |
| `make db-info` | In thông số kết nối Postgres cho pgAdmin trên máy |
| `make docker-build` | Build image production giống Render để thử trước khi deploy |

### Triển khai backend lên Render

1. **Database trên Neon:** tạo project ở region Singapore để gần Render. Lấy 2 chuỗi kết nối: chuỗi **pooled** gán vào `DATABASE_URL` cho app, chuỗi **direct** gán vào `DATABASE_DIRECT_URL` cho migration. Cả hai có `sslmode=require`.
2. Tạo Web Service trên Render, region Singapore, runtime **Docker**. Dockerfile Path là `apps/api/Dockerfile`, Docker Build Context Directory là **gốc repo**, vì image cần cả `packages/shared`.
3. Dockerfile nhiều stage: stage build chạy `npm ci` ở gốc repo, build `packages/shared` rồi `apps/api`; stage chạy chỉ giữ `dist` của hai workspace và dependency production (`npm ci --omit=dev --workspace=apps/api --include-workspace-root`).
4. Lệnh khởi động chạy migration bằng `DATABASE_DIRECT_URL` trước rồi mới start app, để không phụ thuộc vào Pre-Deploy Command.
5. Health Check Path: `/api/v1/health`.
6. Nhập biến môi trường trong dashboard Render: `FRONTEND_URL` là domain Vercel, `REVALIDATE_URL` là domain Vercel cộng `/api/revalidate`, cùng các biến Neon, Cloudinary, JWT, Google.
7. Seed dữ liệu demo một lần bằng `make seed` từ máy, với `DATABASE_URL` trỏ vào chuỗi direct của Neon.
8. Bật auto-deploy từ `main`, đặt Build Filters chỉ gồm `apps/api/**`, `packages/shared/**` và `package-lock.json` để sửa frontend không làm backend build lại.
9. Gói free của Render ngủ khi lâu không có request, Neon cũng tạm dừng compute khi rảnh, nên lần gọi đầu chậm. Mở `/api/v1/health` vài phút trước khi demo hoặc quay video.

Frontend deploy lên Vercel với Root Directory là `apps/web`; phần này do nhóm frontend làm.

## 11. Bàn giao và đối chiếu chấm điểm

Backend bàn giao 8 thứ dưới đây trước khi nhóm frontend bắt đầu nối API. Bảng đối chiếu bên dưới cho biết mỗi yêu cầu chấm điểm do ai đáp ứng, để không bỏ sót.

### Danh sách bàn giao

- [ ] Swagger chạy online và file `openapi.json`.
- [ ] `packages/shared`: enum, schema Zod (4 bước hồ sơ, form đăng tin, đăng ký), kiểu response, hàm nghiệp vụ và `buildJobPostingJsonLd`.
- [ ] Bảng mã lỗi kèm file dịch, để frontend biết hiển thị gì cho từng lỗi.
- [ ] Hợp đồng tích hợp Auth.js: shape response của `/auth/login` và `/auth/oauth/google`, ví dụ callback `jwt` và `session`.
- [ ] Hợp đồng webhook revalidate: header secret, body, danh sách tag.
- [ ] Mẫu helper `apiFetch<T>()` gắn token và chuẩn hóa lỗi, để mọi Server Action dùng chung.
- [ ] DB demo đã seed và danh sách tài khoản demo.
- [ ] Bảng endpoint theo từng trang hoặc tính năng, chia cho từng thành viên.

### Đối chiếu 8 nhóm yêu cầu chung

| # | Yêu cầu | Backend đáp ứng | Frontend phải làm |
| --- | --- | --- | --- |
| 1 | TypeScript | strict, generic, utility type, type guard, kiểu dùng chung | strict bên web, import kiểu từ shared |
| 2 | Kiến trúc và pattern React |  | Thư mục theo feature, 2 custom hook generic, 1 pattern HOC / Render Props / Compound |
| 3 | Quản lý state |  | Zustand persist cho hồ sơ, Context cho theme và ngôn ngữ |
| 4 | Hiệu năng | Phân trang, index, tránh N+1 | Code-splitting, memo có lý do, phân trang hoặc virtualization, ảnh Lighthouse trước và sau |
| 5 | Kiểm thử | Từ 40 test, coverage từ 70% | Test component có tương tác, test async mock API bằng RTL |
| 6 | Xác thực, phân quyền | JWT, RolesGuard, guard sở hữu, kiểm lại trong service | Auth.js, Middleware chặn route, Server Action kiểm session |
| 7 | Backend và API | Toàn bộ |  |
| 8 | Render và SEO | Dữ liệu JSON-LD, sitemap, webhook revalidate | SSG/ISR/SSR, loading/error/not-found, Metadata, sitemap, robots |

### Đối chiếu yêu cầu riêng và nâng cao của đề 5

| Yêu cầu | Backend | Frontend |
| --- | --- | --- |
| Bảng chiến lược render | Endpoint và cache tag (mục 9) | Triển khai và ghi vào báo cáo |
| Route group, layout lồng, loading/error/not-found |  | Toàn bộ |
| JSON-LD JobPosting qua Rich Results Test | Dữ liệu và hàm `buildJobPostingJsonLd` | Nhúng vào trang, chạy Rich Results Test, chụp ảnh |
| Canonical, sitemap tin còn hạn, opengraph-image | `/seo/sitemap`, dữ liệu OG | `sitemap.ts`, `opengraph-image.tsx`, canonical |
| Tin hết hạn trả 404 hoặc noindex | Cờ `seo.indexable`, 404 cho tin ẩn | Đặt `noindex` hoặc gọi `notFound()` |
| Auth.js Credentials + OAuth, role trong Session/JWT | `/auth/login`, `/auth/oauth/google` | Cấu hình provider, augment kiểu |
| Middleware chặn role, Server Action kiểm lại | Guard và kiểm tra trong service | Middleware và Server Action |
| Upload CV PDF tối đa 5 MB, chỉ 2 bên được tải | Toàn bộ | Form upload, nút tải |
| Form hồ sơ nhiều bước lưu nháp, validate từng bước | Endpoint và schema từng bước | Zustand persist, validate bằng schema shared |
| Nâng cao: gợi ý theo kỹ năng | `/me/recommended-jobs`, `matchScore` | Trang gợi ý, hiện % khớp |
| Nâng cao: thông báo khi trạng thái đổi | Notification, unread-count, SSE | Chuông thông báo, polling |
| Nâng cao: song ngữ có hreflang | Bảng dịch, `alternates`, lỗi song ngữ | next-intl, route `/vi` `/en`, hreflang |
| Nâng cao: link triển khai | Render (API), Neon (PostgreSQL), Cloudinary | Vercel |

Trong quyển báo cáo, bạn viết các phần: kiến trúc và sơ đồ CSDL (mục b), ma trận phân quyền và các lớp bảo vệ (mục c), kết quả test và coverage của backend (mục e).

## 12. Thứ tự làm và các điểm cần chốt

Làm theo 8 bước dưới đây, mục tiêu xong backend trong vài ngày. Mỗi bước làm trên một nhánh `feat/api-<bước>` và chia thành việc nhỏ ở checklist bên dưới: mỗi việc là một commit, `make check` xanh thì commit và push ngay; xong bước thì mở pull request vào `main`. Bàn giao Swagger dạng khung ngay sau bước 1 để nhóm frontend không phải chờ.

1. **Khởi tạo monorepo và nền tảng:** npm workspaces, `packages/shared`, khung `apps/api` theo cấu trúc mục 8, `CLAUDE.md`, `CONVENTIONS.md`, `Makefile`, `docker-compose.yml` (Postgres), validate env, `data-source.ts`, AppBaseEntity, migration đầu tiên (extension pg\_trgm, unaccent); entity thêm dần ở bước dùng đến. Phần common: filter, interceptor, guard, decorator, AppException, i18n, Swagger, `/health`.
2. **Auth, Users, Meta:** đăng ký, đăng nhập, Google, refresh token xoay vòng, đăng xuất, khóa tài khoản; seed admin, kỹ năng, tỉnh/thành.
3. **Companies và Jobs:** CloudinaryService, bản dịch, slug, logo trên Cloudinary, vòng đời tin, tìm kiếm công khai, webhook revalidate, cron đóng tin hết hạn.
4. **Profiles và CV:** 4 bước hồ sơ, upload CV lên Cloudinary, tải bằng signed URL có kiểm quyền.
5. **Applications:** nộp đơn, chuyển trạng thái, lịch sử, ghi chú nội bộ, thông báo.
6. **Admin và SEO:** duyệt công ty, ẩn tin, khóa user, thống kê, `/seo/sitemap`, `/seo/static-params`.
7. **Nâng cao:** `/me/recommended-jobs`, SSE thông báo, email.
8. **Hoàn thiện:** seed đầy đủ, đủ test và coverage, Dockerfile, deploy Render, README.

### Việc nhỏ theo từng commit

Mỗi dòng là một commit theo Conventional Commits. Xong dòng nào thì `make check`, commit, push rồi tick dòng đó. Biến env của Cloudinary, Google, Neon chỉ thêm vào schema validate ở bước dùng đến, để các bước trước app vẫn chạy được.

**Bước 1 – Nền tảng** (nhánh `feat/api-foundation`)

- [ ] `chore: khởi tạo monorepo npm workspaces`: package.json gốc, .nvmrc, .editorconfig, .gitignore, README khung
- [ ] `feat(shared): khung packages/shared`: build TypeScript, enum, kiểu Locale
- [ ] `chore(api): khung NestJS`: tsconfig strict, ESLint, Prettier, Jest
- [ ] `chore(api): Makefile, script Node, docker-compose Postgres`
- [ ] `feat(api): config và validate env bằng Zod`
- [ ] `feat(api): TypeORM data-source, AppBaseEntity, migration extension`
- [ ] `feat(api): AppException, mã lỗi, filter và interceptor`
- [ ] `feat(api): i18n lỗi song ngữ và decorator @Lang`
- [ ] `feat(api): Swagger và /health`
- [ ] `docs(api): CONVENTIONS.md và CLAUDE.md`

**Bước 2 – Auth, Users, Meta** (`feat/api-auth`)

- [ ] `feat(api): entity User, Account, RefreshToken`
- [ ] `feat(api): đăng ký ứng viên, đăng nhập, JwtAuthGuard, RolesGuard`
- [ ] `feat(api): refresh token xoay vòng, đăng xuất`
- [ ] `feat(api): /auth/me và đổi mật khẩu`
- [x] `feat(api): đăng nhập Google`: tạo OAuth client Google ở bước này
- [x] `feat(api): danh mục /meta, seed admin, kỹ năng, tỉnh/thành`
- [x] `feat(api): giới hạn tần suất cho auth`

**Bước 3 – Companies, Jobs** (`feat/api-jobs`)

- [ ] `feat(api): CloudinaryService`: lấy key Cloudinary ở bước này
- [ ] `feat(api): công ty, đăng ký nhà tuyển dụng, logo`
- [ ] `feat(shared): slugify và isJobPublic kèm test`
- [ ] `feat(api): admin duyệt, từ chối công ty, phân trang dùng chung` (làm sớm từ bước Admin để test được đăng tin)
- [ ] `feat(api): tin tuyển nháp của nhà tuyển dụng`
- [ ] `feat(api): vòng đời tin đăng, đóng, mở lại`
- [ ] `feat(api): tìm kiếm, chi tiết tin, trang công ty công khai`
- [ ] `feat(api): webhook revalidate và cron đóng tin hết hạn`

**Bước 4 – Profiles, CV** (`feat/api-profiles`)

- [ ] `feat(shared): schema 4 bước hồ sơ`
- [ ] `feat(api): hồ sơ ứng viên 4 bước`
- [ ] `feat(api): upload, đặt mặc định, xóa CV`
- [ ] `feat(api): tải CV bằng signed URL`
- [ ] `feat(api): avatar và tin đã lưu`

**Bước 5 – Applications** (`feat/api-applications`)

- [ ] `feat(shared): canTransition kèm test`
- [ ] `feat(api): nộp đơn, chống nộp trùng`
- [ ] `feat(api): chuyển trạng thái, lịch sử, rút đơn`
- [ ] `feat(api): ghi chú nội bộ`
- [ ] `feat(api): thông báo`

**Bước 6 – Admin, SEO** (`feat/api-admin-seo`)

- [ ] `feat(api): duyệt công ty, ẩn tin, khóa user`
- [ ] `feat(api): thống kê admin và nhà tuyển dụng`
- [ ] `feat(shared): buildJobPostingJsonLd kèm test`
- [ ] `feat(api): /seo/sitemap và /seo/static-params`

**Bước 7 – Nâng cao** (`feat/api-advanced`)

- [ ] `feat(api): gợi ý việc theo matchScore`
- [ ] `feat(api): SSE thông báo`
- [ ] `feat(api): email khi trạng thái đổi` (tùy chọn)

**Bước 8 – Hoàn thiện** (`feat/api-release`)

- [ ] `feat(api): seed đầy đủ dữ liệu demo`
- [ ] `test(api): e2e phân quyền và test đồng thời`
- [ ] `chore(api): Dockerfile`
- [ ] Deploy lên Render + Neon: tạo project Neon, Render và điền env production ở bước này
- [ ] `docs: README và openapi.json`

**Việc ngoài code** (không chặn việc code):

- [ ] Báo giảng viên nhóm chọn kiến trúc C.
- [ ] Thống nhất ai làm Auth.js và Middleware bên Next, gồm luồng tự refresh token.

Đã chốt: có refresh token xoay vòng (mục 6), database production trên Neon, API trên Render, file trên Cloudinary, quản lý gói bằng npm workspaces, hệ thống chỉ có 1 admin tạo qua seed, repo Nhom1\_LTWNC\_CuoiKy với package @ltwnc/api, @ltwnc/shared, @ltwnc/web.
