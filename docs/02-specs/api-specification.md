# Đặc tả API — UniPrep

> Phiên bản: v0.1 — Ngày: 2026-09-26

---

## 1. Phạm vi

Tài liệu này đặc tả **hợp đồng API đích** (REST/HTTP + WebSocket tuỳ chọn) của nền tảng **UniPrep** — hệ thống web hỗ trợ học tập, có thành phần nâng cao **Hướng 5: Learning Analytics & cảnh báo sớm học viên chậm tiến độ**. Yêu cầu chức năng **và stack** được lấy từ `docs/proposal.md` — **source of truth của dự án** (mục 3.1 Functional scope, 3.2 User stories, 4.2 Integration strategy, 5.1–5.2 technology stack); `docs/architecture.md` chỉ được dùng cho các **chi tiết kỹ thuật không làm đổi phạm vi** (mục 4 Phân rã module, 8 Bảo mật & vận hành). Khi hai tài liệu mâu thuẫn, theo `docs/README.md` §1.1: **proposal thắng**. Phần nghiệp vụ nền (khoá học, chương, bài học, bài tập, tiến độ, thảo luận) là **nguồn sinh dữ liệu hành vi** cho phần analytics; nội dung bài học theo proposal §3.1 gồm **text/slide/video** và quiz trắc nghiệm — API **không** gắn với môn tiếng Anh hay bất kỳ môn cụ thể nào trong path/field, và **không** có endpoint cho luyện nói/viết hay chấm phát âm. Tài liệu mô tả **payload API**, không mô tả chi tiết cột của bảng DB — việc đó thuộc một tài liệu khác trong `docs/`.

## 2. Trạng thái triển khai

Đối chiếu với hiện trạng mã nguồn tại `UniPrep/` (xem `UniPrep/README.md`, mục *Status: early scaffold* và *Known limitations*):

**Đã có trong code (đặc tả dưới đây mô tả đúng như đang chạy):**

| Thành phần | Trạng thái |
|---|---|
| `GET /api/health` | Đã có — `HealthModule`, ping database, trả `{ status, uptimeSeconds, timestamp, database }` |
| Envelope `{ error, data, message }` | Đã có — `TransformResponseInterceptor` + `AllExceptionsFilter` |
| Global prefix `/api` | Đã có — `app.setGlobalPrefix('api')` trong `main.ts` |
| Swagger UI tại `/docs` | Đã có — `SwaggerModule.setup('docs', ...)`, đã bật `addBearerAuth()` |
| `ValidationPipe` (`transform`, `whitelist`) + làm phẳng lỗi | Đã có — `main.ts`, hàm `flattenValidationErrors` |
| CORS theo `CORS_ORIGINS` | Đã có — danh sách phân tách bằng dấu phẩy, `credentials: true` |
| TypeORM + PostgreSQL, **`synchronize: false`** | Đã có — schema chỉ đổi qua migration (`backend/src/database/`) |
| Xuất `openapi.json` từ chính app | Đã có — `npm run openapi:export` ghi `backend/openapi.json` |
| `AuthModule` — đăng ký, đăng nhập, refresh, logout, quên/đặt lại/đổi mật khẩu, `GET /auth/me` | **Đã có (E1, 2026-10-03)** — `POST /api/auth/{register,login,refresh,logout,forgot-password,reset-password,change-password}`, `GET /api/auth/me` |
| `UserModule` — hồ sơ cá nhân | **Đã có (E2-T1, 2026-10-03)** — `GET /api/users/me`, `PATCH /api/users/me` (chỉ 4 trường `fullName`/`phone`/`major`/`bio`; `role`/`status`/`email` bị `whitelist` loại bỏ) |
| `UserModule` — quản trị người dùng | **Đã có (E2-T2, 2026-10-03)** — `GET /api/users` (lọc `search`/`role`/`status`, phân trang, sắp xếp), `PATCH /api/users/:id/role`; `PATCH /api/users/:id/status` có từ E1-T5. Chưa làm: `POST /api/users`, `DELETE /api/users/:id`, avatar |
| JWT access + refresh, rotation, thu hồi | **Đã có (E1-T2)** — access 15 phút/refresh 7 ngày (theo `JWT_*`), refresh là JWT mang `type='refresh'` + `familyId` + `jti`, chỉ lưu hash SHA-256 trong `refresh_tokens` |
| RBAC toàn cục | **Đã có (E1-T3)** — `JwtAuthGuard` + `RolesGuard` đăng ký bằng `APP_GUARD`; mặc định **chặn mọi route**, chỉ mở bằng `@Public()`; `@Roles()` cho phân quyền. Danh sách route công khai ở §5.4 |
| Chống IDOR | **Đã có (E1-T6)** — `OwnershipGuard` + `@OwnResource('id')`, áp dụng cho `GET /api/users/:id` (chính chủ hoặc admin) |
| Trạng thái tài khoản & chặn đăng nhập | **Đã có (E1-T5)** — `pending/active/suspended/disabled` + khoá tạm 15 phút sau 10 lần sai (`users.failed_login_count`, `users.locked_until`); admin đổi trạng thái qua `PATCH /api/users/:id/status` (thu hồi mọi phiên ngay) |
| Bảng `password_reset_tokens` | **Đã có (E1-T4)** — migration `1791017471553-AddPasswordResetTokens` |
| `POST/GET/PATCH/DELETE /api/students` | **ĐÃ XOÁ ở E0 (2026-10-03)** — bảng `students` là legacy; schema thật dùng `users` + `enrollments`. Không còn endpoint, không còn `apis/student` ở FE |
| `CourseModule` — danh mục (`categories`) | **Đã có (E3-T3, 2026-10-03)** — `GET/POST /api/categories`, `GET/PATCH/DELETE /api/categories/:id`; đường ghi chỉ `admin`, đường đọc mọi vai trò **đã đăng nhập** (không `@Public()`) |
| `CourseModule` — khoá học | **Đã có (E3-T1, 2026-10-03)** — `GET/POST /api/courses`, `GET/PATCH/DELETE /api/courses/:id`, `PATCH /api/courses/:id/publish`, `PATCH /api/courses/:id/unpublish`; quyền theo **dữ liệu** qua `CourseAccessService` (`courses.owner_id` **hoặc** một dòng `course_instructors`) |
| `CourseModule` — phân công giảng viên | **Đã có (E3-T1)** — `GET/POST /api/courses/:id/instructors`, `DELETE /api/courses/:id/instructors/:userId`; `POST /api/courses` ghi kèm dòng `course_instructors` với `roleInCourse = 'owner'` |
| `CourseModule` — lớp (`cohorts`, E2-T3 chuyển sang E3) | **Đã có (E3-T1)** — `GET/POST /api/courses/:id/cohorts`, `PATCH/DELETE /api/cohorts/:id`; FK là `ON DELETE SET NULL` nên xoá lớp **không** mất ghi danh/phân công |
| `CourseModule` — điều kiện tiên quyết | **Đã có (E3-T5)** — `PUT /api/courses/:id/prerequisites`; `GET /api/courses/:id` trả `prerequisites` + `eligibility`; `POST /api/enrollments` chặn bằng **cùng** quy tắc (`CourseEligibilityService`) |
| `LessonModule` — chương | **Đã có (E3-T2)** — `GET/POST /api/courses/:courseId/sections`, `GET/PATCH/DELETE /api/sections/:id`, `PATCH /api/courses/:courseId/sections/reorder` |
| `LessonModule` — bài học | **Đã có (E3-T2)** — `GET /api/courses/:courseId/lessons`, `POST /api/sections/:sectionId/lessons`, `GET/PATCH/DELETE /api/lessons/:id`, `PATCH /api/lessons/:id/publish`, `PATCH /api/lessons/:id/hide`, `PATCH /api/sections/:sectionId/lessons/reorder` |
| `LessonModule` — học liệu | **Đã có (E3-T4)** — `POST/GET /api/lessons/:id/materials` (upload `multipart/form-data`), `DELETE /api/materials/:id`; lưu **đĩa cục bộ** và phục vụ tĩnh tại `/uploads/**` |
| `EnrollmentModule` — ghi danh & tiến độ | **Đã có (E3-T7 + E4, 2026-10-03)** — list/detail/cancel, progress, complete/uncomplete và resume; `dropped` giữ nguyên dữ liệu học |

> **Số đường dẫn API — xuất lại ngày 2026-10-03 (sau E4):** `backend/openapi.json` đã được sinh lại
> bằng `npm run openapi:export` và **có 42 path template** (trước E3 là 15 — file này trước đó chưa
> từng được xuất lại sau E2). Đây là con số duy nhất được dùng trong tài liệu: **không** tự cộng
> handler theo module để suy ra "tổng đường dẫn" vì một path template có thể có nhiều method (ví dụ
> `GET|POST /api/courses`). Sau mỗi epic làm đổi hợp đồng API, phải chạy lại `openapi:export` và
> commit `openapi.json` cùng PR — diff của nó là bằng chứng hợp đồng đã đổi những gì.

**Chưa có trong code — toàn bộ phần còn lại của tài liệu này là ĐẶC TẢ ĐÍCH để nhóm code theo:**

- ~~Auth/JWT/Passport/RBAC~~ — **đã xong ở E1 (2026-10-03)**; xem bảng phía trên.
- ~~Khoá học / chương / bài học / học liệu (`CourseModule`, `LessonModule`)~~ — **đã xong ở E3
  (2026-10-03)**; xem bảng phía trên (E3-T2 chương/bài học, E3-T4 học liệu).
- ~~Điều kiện tiên quyết (`course_prerequisites`)~~ — **đã xong ở E3-T5**.
- ~~Ghi danh & tiến độ (`enrollments`, `lesson_progress`)~~ — **đã xong E4 (2026-10-03)**;
  quiz/điểm trung bình vẫn thuộc E5, telemetry thuộc E7.
- Quiz / bài nộp / chấm tự động (`ExerciseModule`).
- Telemetry hành vi (`learning_events`, `LearningActivityModule`) — **bảng đã có** (E0-T5), thiếu endpoint ghi.
- Analytics dashboard (`AnalyticsModule`) — chưa có dashboard; mock khoá học của E3 đã bị xoá.
- Queue Redis + BullMQ và job AI (`AIGatewayModule`).
- Service AI FastAPI (Python) — chưa tồn tại.
- Thông báo, can thiệp, quản trị (`NotificationModule`, `InterventionModule`, `AdminModule`).
- Test suite: **đã có 4 unit tests và 1 HTTP e2e suite cho E4**; E0-T7 vẫn hoãn theo quyết định 2026-10-03.

> **Quy ước đọc tài liệu:** mọi nội dung **không** suy ra được từ mã nguồn hiện có đều được đánh dấu **(đề xuất)**. Những con số như TTL token, ngưỡng rate limit, giới hạn dung lượng file, số job trong lô là **đề xuất cần nhóm chốt**, không phải giá trị đã tồn tại trong repo.
>
> **Cập nhật E3 (2026-10-03):** riêng **giới hạn dung lượng file** đã hết là đề xuất — nó là
> `MAX_UPLOAD_SIZE_MB` (mặc định **50**) đọc từ `.env` trong `StorageService` và được thực thi thật
> (`413`); xem §7 LessonModule (học liệu) và §13 câu hỏi 3 (đã chốt: lưu đĩa cục bộ).

---

## 3. Quy ước chung

### 3.1 Base URL & môi trường

| Môi trường | Base URL API | Swagger UI | Ghi chú |
|---|---|---|---|
| Local (dev) | `http://localhost:3000/api` | `http://localhost:3000/docs` | Cổng lấy từ biến `PORT` (mặc định `3000`) |
| Frontend dev | `http://localhost:5173` | — | Vite proxy `/api` → `http://localhost:3000` |
| Staging/Production | `https://<host>/api` | `/docs` | Qua Cloudflare tunnel theo `deploy/` |

- **Mọi route đều có tiền tố `/api`** (`app.setGlobalPrefix('api')`). Path trong tài liệu này luôn ghi ở dạng đầy đủ `/api/...`.
- Frontend gọi qua `queryMethod` (`frontend/src/config/query-method/axiosMethod.config.ts`), `baseURL = VITE_API_BASE_URL || 'http://localhost:3000/api'`, `timeout = 15000` ms. Interceptor đã bóc `response.data`, nên tầng `apis/<feature>` nhận **trực tiếp envelope**.

### 3.2 Envelope

**Mọi** response — thành công hay thất bại — có đúng ba khoá `error`, `data`, `message`, do `TransformResponseInterceptor` và `AllExceptionsFilter` sinh ra.

Thành công:

```json
{"error":false,"data":{"id":"3f1b0f5e-2c6a-4a5e-9a1f-1c2d3e4f5a6b"},"message":"Thành công"}
```

Thất bại:

```json
{"error":true,"data":null,"message":"Không tìm thấy khoá học với ID 3f1b0f5e-2c6a-4a5e-9a1f-1c2d3e4f5a6b"}
```

Quy tắc bắt buộc:

1. `data` **luôn là `null`** khi `error: true`.
2. **Giữ nguyên HTTP status code thật** — không "200 hoá" lỗi. Envelope không thay thế status code.
3. `message` là **tiếng Việt**, câu hoàn chỉnh, có thể hiển thị thẳng cho người dùng cuối. Khi exception không có message riêng, `AllExceptionsFilter` thay bằng message mặc định theo status (xem mục 4).
4. Với danh sách, `data` là **object** `{ items, meta }` chứ không phải mảng trần (xem 3.4).
5. **Không dùng HTTP 204 No Content.** Thao tác xoá trả `200` kèm envelope, ví dụ `data: { "success": true }` (đúng như `StudentService.remove` đang trả).
6. Nếu service/controller trả về object đã có đủ ba khoá `error`/`message`/`data`, interceptor **giữ nguyên** (không bọc lần hai). Đây là cơ chế có sẵn, không phải quy ước mới.

### 3.3 Kiểu dữ liệu chung và union type

**Không dùng TypeScript `enum`** trong toàn bộ backend (kể cả entity, DTO, hằng số `.ts`). Mọi tập giá trị đóng biểu diễn bằng **union type**; ở tầng DB dùng `varchar` + `CHECK` (hoặc `text`) chứ không dùng kiểu `enum` của Postgres. Danh sách union type chuẩn của hệ thống:

```ts
// --- Người dùng & phiên ---
export type UserRole = 'student' | 'teacher' | 'admin';
export type UserStatus = 'active' | 'locked' | 'pending';

// --- Nội dung học tập ---
export type CourseStatus = 'draft' | 'published' | 'archived';
export type PublishState = 'draft' | 'published' | 'hidden';
export type LessonType = 'text' | 'video' | 'slide' | 'file';
export type MaterialKind = 'pdf' | 'slide' | 'video' | 'document' | 'archive' | 'other';

// --- Học tập & đánh giá ---
export type EnrollmentStatus = 'active' | 'cancelled' | 'completed';
export type ProgressState = 'not_started' | 'in_progress' | 'completed';
export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false';
export type QuizStatus = 'draft' | 'published' | 'closed';
export type AttemptStatus = 'in_progress' | 'submitted' | 'expired';
export type SubmissionStatus = 'submitted' | 'graded' | 'late';

// --- Telemetry ---
export type LearningEventType =
  | 'login'
  | 'lesson_started'
  | 'lesson_completed'
  | 'material_viewed'
  | 'quiz_started'
  | 'quiz_submitted'
  | 'discussion_posted'
  | 'video_watched';

// --- Analytics & AI ---
export type RiskLevel = 'low' | 'medium' | 'high';
export type AiJobType = 'risk.predict.single' | 'risk.predict.batch' | 'ai.healthcheck';
export type AiJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type Granularity = 'day' | 'week';

// --- Can thiệp & thông báo ---
export type InterventionStatus = 'pending' | 'sent' | 'acknowledged' | 'completed';
export type InterventionChannel = 'in_app' | 'email';
export type NotificationType = 'risk_alert' | 'intervention' | 'system' | 'deadline';
export type ContentReportStatus = 'pending' | 'resolved' | 'rejected';

// --- Tham số chung ---
export type SortOrder = 'asc' | 'desc';
```

> **Cập nhật E3 (2026-10-03) — khối union trên đã lệch so với schema thắng (`database-design.md`
> §7.2–§7.6) ở đúng những dòng liên quan tới nội dung khoá học:**
> - `CourseStatus` = `'draft' | 'published' | 'hidden' | 'archived'` (§7.2) — bản cũ ở trên thiếu
>   `hidden`. Phía FE, tên `CourseStatus` được tách thành `CoursePublishStatus` (cột DB) và
>   `LearnerCourseStatus` (`'in-progress' | 'future' | 'past'`, suy diễn — §7.2).
> - `LessonType` **không tồn tại** trong mã nguồn: `lessons` có `content` + `contentFormat`
>   (`'markdown' | 'html' | 'tiptap_json'`), còn loại bài học là `derivedType` **suy diễn** từ
>   `lesson_materials` (video > slide > file > text) — xem §7 LessonModule.
> - `MaterialKind` **không tồn tại**: thay bằng `MaterialType` = `'text' | 'slide' | 'video' | 'file' | 'link'` (§7.6).
> - `EnrollmentStatus` = `'active' | 'completed' | 'dropped' | 'expired'` (§7.3) — **không** có
>   `'cancelled'`; trạng thái "người gọi còn quyền xem nội dung" là `'active' | 'completed'`.
> - `UserStatus` = `'pending' | 'active' | 'suspended' | 'disabled'`.
>
> Các union còn lại của khối trên (quiz, bài nộp, telemetry, analytics/AI, can thiệp/thông báo) vẫn
> là **đặc tả đích**, chưa có gì thay đổi.

Quy ước kiểu dữ liệu field:

| Khái niệm | Kiểu JSON | Ghi chú |
|---|---|---|
| ID | `string` (UUID v4) | Mọi resource trả `id` |
| Thời điểm | `string` ISO 8601 UTC | `createdAt`, `updatedAt`; ví dụ `2026-09-26T08:15:30.000Z` |
| Ngày (chỉ ngày) | `string` `YYYY-MM-DD` | Dùng cho `dueDate`, `from`, `to` |
| Điểm số | `number` | `score` 0–10 (thang điểm 10), làm tròn 2 chữ số thập phân |
| Tỷ lệ | `number` | `riskScore`, `completionRate` trong khoảng `0`–`1` |
| Đếm | `number` | `integer`, không âm |
| Cờ | `boolean` | `true`/`false` |
| Tên field JSON | `camelCase` | Không dùng `snake_case` ở tầng API (khác tên cột DB) |

Mọi resource trả kèm **tối thiểu** `id`, `createdAt`, `updatedAt` (kế thừa `BaseEntityCustom` ở backend và `BaseEntity` ở `frontend/src/types/index.ts`).

> **Ngoại lệ đã chốt (2026-10-03, E3):** `SectionListItem` và `LessonListItem`
> (`backend/src/lesson/types/lesson.type.ts`) **cố ý không** trả `createdAt`/`updatedAt`
> (`SectionDetail`/`LessonDetail` kế thừa và cũng không có). Lý do: hai hình dạng này là **mục lục
> điều hướng**, được trả nguyên một danh sách cho mỗi lần mở khoá học — thêm hai dấu thời gian mà
> không giao diện nào dùng là làm phình mọi response mục lục (một khoá 100 bài trả thêm 200 field).
> Quy tắc §3.3 vì vậy được đọc là "mọi resource **có vòng đời riêng**", và ngoại lệ này là quyết
> định, không phải thiếu sót. Ai cần dấu thời gian của bài học thì `GET /api/lessons/:id`… **không**
> có — dùng `createdAt` của học liệu hoặc bổ sung vào cả ba nơi (backend type, mapper, `types/lesson.ts`)
> nếu một epic sau thực sự cần.

### 3.4 Phân trang

Tài liệu này chốt **một dạng response phân trang duy nhất** cho **mọi** endpoint danh sách:

```ts
// Query — dùng đúng interface đã có ở frontend/src/types/index.ts
interface PageOptions {
  page?: number; // >= 1, mặc định 1
  take?: number; // 1..100, mặc định 20
}

// Response meta — dùng đúng interface đã có
interface PageMetaDto {
  page: number;
  take: number;
  itemCount: number;      // tổng số bản ghi khớp điều kiện
  pageCount: number;      // ceil(itemCount / take), tối thiểu 1
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
```

Envelope của mọi endpoint danh sách:

```json
{
  "error": false,
  "data": {"items":[{"id":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","code":"CS101","name":"Nhập môn lập trình","status":"published","createdAt":"2026-09-20T02:00:00Z","updatedAt":"2026-09-24T09:30:00Z"}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

Quy tắc:

- `data.items` là `T[]`; `data.meta` là `PageMetaDto`. **Không** trả mảng trần ở bất kỳ endpoint danh sách nào (kể cả `GET /api/students` khi được nâng cấp — xem mục 13, câu hỏi 1).
- `page` hoặc `take` không hợp lệ (âm, 0, chữ, `take > 100`) → HTTP `400`.
- `page` vượt quá `pageCount` → trả `200` với `items: []`, `meta` phản ánh giá trị yêu cầu.
- Endpoint danh sách **bắt buộc** hỗ trợ `page` + `take`; các endpoint có thêm `search`/`sortBy`/`order` được ghi rõ ở từng endpoint.

> **Bổ sung ở E3 (2026-10-03) — hai biến thể của "endpoint danh sách":**
> 1. **Collection vẫn trả `{ items, meta }` dù người dùng không cần phân trang:** `GET /api/courses/:courseId/sections`
>    (mặc định `take = 100`) và `GET /api/lessons/:id/materials` (`take` mặc định 20). Chúng vẫn theo đúng
>    quy tắc ở trên, `itemCount` vẫn là **tổng**.
> 2. **Collection chỉ trả `{ items }`, KHÔNG có `meta`:** `GET /api/courses/:id/instructors`,
>    `GET /api/courses/:id/cohorts`, `PUT /api/courses/:id/prerequisites` (và `CourseDetail.instructors`
>    là mảng trực tiếp). Đây vẫn là object bọc `items` — **không** phải mảng trần — nên không phá quy tắc
>    "không trả mảng trần", nhưng FE đọc `data.items` mà **không** được giả định có `data.meta`.

### 3.5 Lọc & sắp xếp

Mọi endpoint danh sách hỗ trợ bốn tham số chung (nếu không có ghi chú khác):

| Tham số | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `page` | number | `1` | Trang, bắt đầu từ 1 |
| `take` | number | `20` | Số bản ghi mỗi trang, tối đa 100 |
| `search` | string | — | Tìm gần đúng (ILIKE `%...%`) trên các cột text đại diện của resource đó (ghi rõ ở từng endpoint) |
| `sortBy` | string | `createdAt` | Tên field được phép sắp xếp, whitelist theo resource |
| `order` | `asc` \| `desc` | `desc` | Chiều sắp xếp |

- `sortBy` nằm ngoài whitelist → `400` với message `"sortBy: giá trị không được hỗ trợ"` (đề xuất). Không bao giờ nội suy thẳng `sortBy` vào SQL.
- Tham số lọc dạng danh sách (ví dụ `status`) nhận **nhiều giá trị phân tách bằng dấu phẩy**: `?status=published,draft`.
- Tham số boolean nhận `true`/`false` (chuỗi), được `transform` của `ValidationPipe` ép kiểu.

### 3.6 Định dạng ngày giờ

- **Mọi mốc thời gian trong response là ISO 8601 UTC** dạng `2026-09-26T08:15:30.000Z` (TypeORM trả `Date` → `JSON.stringify` ra chuỗi ISO; giữ nguyên, không format lại ở backend).
- **FE chịu trách nhiệm hiển thị theo giờ Việt Nam (UTC+7)** — không trả timezone offset khác trong API.
- Tham số lọc thời gian `from`/`to` nhận **`YYYY-MM-DD`** (bao gồm cả hai đầu, hiểu theo UTC) hoặc ISO 8601 đầy đủ khi cần độ chính xác giây.
- Nếu `from > to` → HTTP `400`, message `"from: ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc"` (đề xuất).
- `durationSeconds` là **số nguyên giây**, không phải mili giây.

### 3.7 Xử lý lỗi validate

Cấu hình hiện có trong `UniPrep/backend/src/main.ts`:

```ts
new ValidationPipe({
  transform: true,
  whitelist: true,
  exceptionFactory: (errors) => new BadRequestException({
    message: validationErrors.length > 0 ? validationErrors : ['Dữ liệu gửi lên không hợp lệ.'],
    error: 'Yêu cầu không hợp lệ',
  }),
})
```

Hệ quả **bắt buộc** mà FE phải xử lý:

1. Lỗi validate trả **HTTP `400`**.
2. `AllExceptionsFilter` nhận mảng `message`, và khi `Array.isArray(msg)` thì **nối bằng `'; '`** thành một **chuỗi duy nhất**. Vì vậy `message` trong body thực tế là **một string**, trong đó mỗi phần tử có dạng `"<field>: <thông báo>"`.
3. `flattenValidationErrors` sinh ra các phần tử theo đúng công thức `"${đường_dẫn_field}: ${constraint}"`, và **đi sâu vào DTO lồng nhau** với đường dẫn phân tách bằng dấu chấm.
4. `whitelist: true` → field lạ trong body bị **loại bỏ im lặng**, không gây lỗi.

Ví dụ body lỗi validate thực tế (chuỗi đã nối):

```json
{"error":true,"data":null,"message":"email: email must be an email; password: Mật khẩu phải chứa từ 8 đến 16 ký tự!"}
```

Mảng trước khi filter nối (giá trị do `flattenValidationErrors` trả về — dùng để viết unit test):

```json
["email: email must be an email","password: Mật khẩu phải chứa từ 8 đến 16 ký tự!","profile.address: address should not be empty"]
```

> **Lưu ý nhất quán:** một số tài liệu/khách hàng có thể kỳ vọng `message` là **mảng**. Tài liệu này chốt theo **hành vi thật của code hiện tại** (`message` là string đã nối) và ghi nhận việc "trả mảng để FE render từng dòng" là một **thay đổi cần nhóm quyết định** (mục 13, câu hỏi 2) — nếu đổi, phải sửa `AllExceptionsFilter` cho cả hệ thống, không sửa cục bộ.

### 3.8 Header

**Header request:**

| Header | Bắt buộc | Mô tả |
|---|---|---|
| `Content-Type` | Có (trừ GET/DELETE) | `application/json`; `multipart/form-data` cho upload |
| `Authorization` | Với endpoint được bảo vệ | `Bearer <accessToken>` — đúng scheme đã bật trong Swagger (`addBearerAuth()`) |
| `Accept-Language` | Không | Hiện chỉ hỗ trợ `vi`; mọi message là tiếng Việt |
| `X-Request-Id` | **Không — (đề xuất)** | Nếu client gửi, backend ghi lại vào log và **echo lại trong header response** để đối chiếu; chưa có trong code |
| `Idempotency-Key` | **Không — (đề xuất)** | Xem mục 10 |

**Header response:**

| Header | Mô tả |
|---|---|
| `X-Request-Id` **(đề xuất)** | Echo lại `X-Request-Id` của client, hoặc UUID do server sinh nếu client không gửi |
| `Retry-After` | Chỉ có ở `429`; số giây cần chờ (đề xuất) |
| `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` **(đề xuất)** | Thông tin hạn mức, chỉ áp dụng cho các route bị rate limit |
| `Content-Type` | `application/json; charset=utf-8` |

---

## 4. Bảng mã lỗi chuẩn

Message mặc định dưới đây lấy **nguyên văn** từ `fallbackMessages` trong `UniPrep/backend/src/common/filters/all-exceptions.filter.ts` — đây là giá trị hệ thống dùng khi exception không kèm message. Cột "Mã lỗi nội bộ" là **(đề xuất)** cho giai đoạn sau; **hiện tại code không trả mã lỗi nội bộ**, chỉ trả HTTP status + `message`.

| HTTP | Mã lỗi nội bộ (đề xuất) | `message` tiếng Việt mẫu | Khi nào dùng |
|---|---|---|---|
| `400` | `VALIDATION_ERROR` | `Dữ liệu gửi lên không hợp lệ.` | Lỗi mặc định của `BadRequestException` khi không có message riêng |
| `400` | `VALIDATION_ERROR` | `email: email must be an email; password: Mật khẩu phải chứa từ 8 đến 16 ký tự!` | Lỗi validate DTO — dạng `<field>: <thông báo>`, nối bằng `'; '` |
| `400` | `INVALID_QUERY` | `take: take phải là số nguyên từ 1 đến 100` | `page`/`take`/`sortBy`/`order`/`from`/`to` không hợp lệ |
| `400` | `BAD_STATE` | `Không thể nộp bài: lượt làm đã hết hạn.` | Nghiệp vụ hợp lệ về hình thức nhưng sai trạng thái |
| `401` | `UNAUTHENTICATED` | `Bạn chưa đăng nhập hoặc phiên đã hết hạn.` | Thiếu/sai/hết hạn `Authorization`; token sai chữ ký |
| `401` | `INVALID_CREDENTIALS` | `Email hoặc mật khẩu không đúng.` | Sai thông tin đăng nhập (dùng chung cho cả email không tồn tại để tránh dò tài khoản) |
| `401` | `TOKEN_EXPIRED` | `Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.` | Access token hết hạn |
| `401` | `REFRESH_TOKEN_INVALID` | `Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.` | Refresh token sai/đã thu hồi/đã dùng lại |
| `403` | `FORBIDDEN` | `Bạn không có quyền thực hiện thao tác này.` | Đã xác thực nhưng sai vai trò |
| `403` | `NOT_OWNER` | `Bạn không phụ trách khoá học này.` | Giảng viên truy cập tài nguyên không thuộc khoá mình phụ trách |
| `403` | `OUT_OF_SCOPE` | `Bạn chỉ có thể xem dữ liệu của chính mình.` | Học viên truy cập dữ liệu của người khác |
| `403` | `ACCOUNT_LOCKED` | `Tài khoản của bạn đã bị khoá. Vui lòng liên hệ quản trị viên.` | `users.status = 'locked'` |
| `404` | `NOT_FOUND` | `Không tìm thấy dữ liệu yêu cầu.` | Message mặc định khi không có message riêng |
| `404` | `NOT_FOUND` | `Không tìm thấy khoá học với ID <uuid>` | Không tìm thấy theo ID — theo mẫu `StudentService.findOne` |
| `404` | `ROUTE_NOT_FOUND` | `Không tìm thấy dữ liệu yêu cầu.` | Sai path/method |
| `409` | `DUPLICATE` | `Dữ liệu đang xung đột, vui lòng kiểm tra lại.` | Message mặc định cho xung đột |
| `409` | `DUPLICATE` | `Email này đã được sử dụng.` | Trùng unique: `users.email`, `courses.code`, `categories.slug`, `enrollments (userId, courseId)`, `lesson_progress` |
| `409` | `DUPLICATE` | `Bạn đã ghi danh khoá học này.` | Ghi danh trùng |
| `409` | `CANCEL_CONFLICT` | `Không thể xoá khoá học đã có học viên ghi danh.` | Xoá/huỷ resource đang bị tham chiếu |
| `413` | `PAYLOAD_TOO_LARGE` | `Tệp tải lên vượt quá dung lượng cho phép.` | Upload vượt giới hạn (đề xuất dùng `413`) |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | `Định dạng tệp không được hỗ trợ.` | Upload sai MIME/đuôi (đề xuất dùng `415`) |
| `422` | `UNPROCESSABLE` | `Dữ liệu hợp lệ về định dạng nhưng không xử lý được.` | **Chỉ dùng (đề xuất)** cho lỗi nghiệp vụ sâu không quy được về 400 — xem ghi chú dưới bảng |
| `429` | `RATE_LIMITED` | `Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.` | Vượt rate limit (đăng nhập, refresh, telemetry) — message đúng nguyên văn `fallbackMessages[429]` |
| `500` | `INTERNAL_ERROR` | `Hệ thống đang bận. Vui lòng thử lại sau.` | Lỗi không lường trước — message đúng nguyên văn `fallbackMessages[500]` |
| `502` / `503` | `AI_SERVICE_UNAVAILABLE` | `Dịch vụ phân tích hiện không sẵn sàng, vui lòng thử lại sau.` | FastAPI/Redis/BullMQ không phản hồi (đề xuất) |

Ghi chú về `422`: `docs/proposal.md` và code hiện tại **không dùng 422**. Để tránh hai quy ước lỗi chồng nhau, tài liệu chốt: **mọi lỗi đầu vào dùng `400`**; `422` chỉ được dùng khi nhóm quyết định tách "lỗi định dạng" (400) khỏi "lỗi nghiệp vụ" (422). Các endpoint dưới đây ghi `400` là mặc định.

---

## 5. Xác thực & phiên

### 5.1 Token, TTL và chính sách mật khẩu

| Hạng mục | Giá trị chốt | Nguồn |
|---|---|---|
| Cơ chế | JWT **access + refresh** + Passport.js | `docs/architecture.md` mục 3.2 |
| Thuật toán ký | **HS256** (mặc định), cấu hình qua biến môi trường | **Đã có (E1-T2)** — `JwtModule` đọc `JWT_ALGORITHM` |
| Secret | `JWT_SECRET` (bắt buộc, đọc từ `.env`) | **Đã có (E1-T2)** — thiếu biến thì app **dừng ngay lúc khởi động** (fail-fast) |
| Access token TTL | **15 phút**, qua `JWT_ACCESS_TTL` | **Đã có (E1-T2)** |
| Refresh token TTL | **7 ngày**, qua `JWT_REFRESH_TTL` | **Đã có (E1-T2)** |
| Lưu refresh token | **Có — bảng `refresh_tokens`**, lưu hash của token + `userId`, `expiresAt`, `revokedAt`, `createdAt` | Bảng đã có trong danh sách entity; chi tiết cột ở tài liệu DB |
| Thu hồi | **Thu hồi khi logout** (set `revokedAt`); refresh token là **one-time-use**: mỗi lần `/auth/refresh` thành công, token cũ bị thu hồi và cấp cặp token mới (rotation) | **Đã có (E1-T2)** — refresh token là JWT mang thêm `type='refresh'`, `familyId` và `jti`; `jti` là bắt buộc để hai lần xoay trong cùng một giây không sinh ra cùng chuỗi token (vi phạm UNIQUE `token_hash`) |
| Phát hiện dùng lại | Nếu refresh token **đã bị xoay** (`revoked_reason = 'rotated'`) mà vẫn được dùng → thu hồi **toàn bộ** phiên của user đó. Token bị thu hồi vì `logout` / `admin_revoke` / đổi-đặt lại mật khẩu thì chỉ trả `401`, **không** thu hồi các phiên khác (E1-T2) | **Đã có (E1-T2)** |
| Claims trong access token | `sub` (userId), `email`, `role`, `iat`, `exp`; thêm `type='access'` | **Đã có (E1-T2)** — `type` để chặn dùng access token như refresh token và ngược lại |
| Chính sách mật khẩu | **8–16 ký tự**, có **chữ hoa**, **chữ thường**, **chữ số**, **ký tự đặc biệt** | Khớp `frontend/src/components/PasswordInput/PasswordInput.tsx`; backend có `@IsStrongPassword()` cùng thứ tự kiểm tra/message (E1-T1) |
| Băm mật khẩu | `bcrypt`, cost 10 | **Đã chốt & đã có (E1-T1)** — dùng `bcryptjs` (thuần JS, không cần build native trên Windows), cost đọc từ `BCRYPT_SALT_ROUNDS` |
| Reset password | Token một lần trong `password_reset_tokens`, TTL **30 phút**, dùng xong thu hồi | **Đã có (E1-T4)** — token ngẫu nhiên 32 byte, chỉ lưu SHA-256; yêu cầu mới **vô hiệu hoá** token chưa dùng trước đó; đổi mật khẩu xong thu hồi **mọi** refresh token |

Regex chính sách mật khẩu **phải khớp FE** (nguồn: `PasswordInput.tsx`): `^.{8,16}$` **và** `(?=.*[A-Z])` **và** `(?=.*[a-z])` **và** `(?=.*\d)` **và** `(?=.*[!@#$%^&*])`. Message lỗi tiếng Việt giữ nguyên văn như FE:

- `Mật khẩu phải chứa từ 8 đến 16 ký tự!`
- `Mật khẩu phải chứa chữ viết hoa!`
- `Mật khẩu phải chứa chữ viết thường!`
- `Mật khẩu phải chứa chữ số!`
- `Mật khẩu phải chứa ký tự đặc biệt!`

### 5.2 Luồng

**Đăng ký:** client `POST /api/auth/register` → server kiểm tra email chưa tồn tại (nếu trùng → `409`) → băm mật khẩu → tạo `users` với `role = 'student'` (mặc định; **không cho phép client tự chọn role**, tránh leo thang đặc quyền) → trả cặp token + hồ sơ.

**Đăng nhập:** client `POST /api/auth/login` → kiểm tra email/mật khẩu (sai → `401` với cùng một message, không tiết lộ email có tồn tại hay không) → kiểm tra tài khoản: đang bị khoá tạm do sai nhiều lần (`locked_until`) hoặc `status` khác `active` → `403` kèm message riêng cho từng trường hợp → tạo access token + refresh token, ghi một row `refresh_tokens` → trả cặp token + hồ sơ.

> **Thứ tự kiểm tra đã chốt ở E1-T1:** mật khẩu **trước**, trạng thái/khoá **sau**. Nhờ vậy người gõ sai mật khẩu luôn nhận `401` chung (không dò được tài khoản nào đang bị khoá), còn người gõ **đúng** mật khẩu nhận `403` nêu rõ lý do. Email không tồn tại vẫn bị "đốt" thời gian bằng một lần `bcrypt.compare` với hash giả để thời gian phản hồi không tiết lộ email có thật hay không.
>
> **Khoá tạm (E1-T5):** `LOGIN_MAX_FAILED_ATTEMPTS = 10`, `LOGIN_LOCKOUT_MINUTES = 15` (hằng số trong `auth/constants/auth.constant.ts`, đúng ngưỡng §12). Chạm ngưỡng ⇒ đặt `locked_until` và **đưa `failed_login_count` về 0**. Tài khoản bị khoá tạm vẫn `status = 'active'`, nên **mọi cửa vào** (`login`, `refresh`, `JwtStrategy`) đều phải kiểm tra `locked_until`, không chỉ `status`.

**Refresh:** client `POST /api/auth/refresh` với `refreshToken` → verify chữ ký + tra `refresh_tokens` (phải tồn tại, chưa `revokedAt`, chưa hết hạn) → thu hồi token cũ, phát hành cặp mới → trả cặp token. Token cũ **đã bị xoay** dùng lại → `401` và thu hồi mọi phiên của user (E1-T2; token bị thu hồi do logout/khoá tài khoản chỉ trả `401`). Tài khoản không còn dùng được → `403`.

**Đăng xuất:** `POST /api/auth/logout` (cần access token) → set `revokedAt` cho refresh token được gửi lên. Nếu client không gửi `refreshToken` (hoặc token không thuộc người dùng đang gọi), server thu hồi **mọi** refresh token đang hoạt động của user. Logout **idempotent**: gọi lại vẫn `200`.

**Quên mật khẩu:** `POST /api/auth/forgot-password` → **luôn trả `200`** dù email có tồn tại hay không (chống dò tài khoản); nếu tồn tại, tạo token trong `password_reset_tokens` và gửi email. **Chưa có module email** — ở dev token được ghi ra log của server (`MailService`, chỉ khi `NODE_ENV != production`); ở production chỉ ghi cảnh báo rằng kênh email chưa cấu hình. Yêu cầu mới **vô hiệu hoá** các token chưa dùng trước đó (chỉ link mới nhất còn hiệu lực).

**Đặt lại mật khẩu:** `POST /api/auth/reset-password` với `token` + `password` → verify token còn hạn, chưa dùng → cập nhật mật khẩu → đánh dấu `used_at` → **thu hồi toàn bộ refresh token** của user. Đặt lại mật khẩu cũng mở khoá tạm (`locked_until = NULL`, `failed_login_count = 0`) vì người dùng đã chứng minh quyền sở hữu email.

**Đổi mật khẩu:** `POST /api/auth/change-password` (đã đăng nhập) → xác minh `currentPassword` (sai → **`400`**, xem ghi chú dưới) → chặn trùng mật khẩu cũ (so bằng `bcrypt.compare`, `400`) → cập nhật → **thu hồi toàn bộ refresh token** của user (buộc đăng nhập lại ở các thiết bị khác).

> **Vì sao `400` chứ không `401` (sửa ở E2, 2026-10-03):** người gọi **đã** xác thực thành công — cái sai nằm ở dữ liệu trong body, không phải ở danh tính/phiên. Ngoài ngữ nghĩa HTTP, `401` còn gây lỗi thật ở frontend: interceptor (`axiosMethod.config.ts`) coi **mọi** `401` là "access token hết hạn" nên mỗi lần người dùng gõ nhầm mật khẩu cũ là một lần xoay refresh token vô ích. E1 đã trả `401`; DoD E2-T1 ghi `400` nên đã sửa về `400` và giữ nguyên message `"Mật khẩu hiện tại không đúng."`.

### 5.3 Endpoint

#### `POST /api/auth/register`
Đăng ký tài khoản mới (mặc định vai trò `student`).

- **Quyền:** công khai (không cần token)

```json
{"email":"sv2026001@hcmut.edu.vn","password":"Abcd@1234","fullName":"Nguyễn Văn A","studentCode":"SV2026001"}
```

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `email` | string | ✔ | `@IsEmail()`, duy nhất, tối đa 255 |
| `password` | string | ✔ | Chính sách mật khẩu ở 5.1 |
| `fullName` | string | ✔ | 1–100 ký tự, không rỗng |
| `studentCode` | string | ✖ | Chỉ dùng khi tạo học viên; duy nhất nếu có (đề xuất) |

**201 Created**

```json
{
  "error": false,
  "data": {"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","refreshToken":"b0f5a1c2-8d3e-4f5a-9b6c-7d8e9f0a1b2c.9c1d...","tokenType":"Bearer","expiresIn":900,"user":{"id":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","email":"sv2026001@hcmut.edu.vn","fullName":"Nguyễn Văn A","role":"student","status":"active","avatarUrl":null,"createdAt":"2026-09-26T08:15:30Z","updatedAt":"2026-09-26T08:15:30Z"}},
  "message": "Đăng ký thành công"
}
```

**Lỗi thường gặp:** `400` (sai chính sách mật khẩu/email), `409` `"Email này đã được sử dụng."`, `429` (nếu bật rate limit cho register — đề xuất 5 lần/giờ/IP).

#### `POST /api/auth/login`
Đăng nhập và nhận cặp token.

- **Quyền:** công khai

```json
{"email":"sv2026001@hcmut.edu.vn","password":"Abcd@1234"}
```

**200 OK** — `data` giống hệt `register` (cặp token + `user`).

**Lỗi thường gặp:** `400` (thiếu field), `401` `"Email hoặc mật khẩu không đúng."`, `403` `"Tài khoản của bạn đã bị tạm khoá. Vui lòng liên hệ quản trị viên."` (hoặc message riêng cho `pending`/`disabled`, hoặc `"Tài khoản của bạn đang bị tạm khoá 15 phút do đăng nhập sai quá nhiều lần..."` khi vượt ngưỡng), `429` (xem §12 — chưa làm ở E1).

#### `POST /api/auth/refresh`
Làm mới access token bằng refresh token.

- **Quyền:** công khai (chính refresh token là bằng chứng)

```json
{"refreshToken":"b0f5a1c2-8d3e-4f5a-9b6c-7d8e9f0a1b2c.9c1d..."}
```

**200 OK**

```json
{
  "error": false,
  "data": {"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","refreshToken":"c1a6b2d3-9e4f-4a6b-8c7d-8e9f0a1b2c3d.1d2e...","tokenType":"Bearer","expiresIn":900},
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `401` `"Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại."` (token sai/đã thu hồi/đã dùng), `403` (tài khoản bị khoá sau khi cấp token), `429` (đề xuất 30 lần/giờ/IP).

#### `POST /api/auth/logout`
Thu hồi refresh token hiện tại, kết thúc phiên.

- **Quyền:** đã đăng nhập

```json
{"refreshToken":"c1a6b2d3-9e4f-4a6b-8c7d-8e9f0a1b2c3d.1d2e..."}
```

**200 OK**

```json
{"error":false,"data":{"success":true},"message":"Đăng xuất thành công"}
```

**Lỗi thường gặp:** `401` (thiếu/hết hạn access token).

#### `POST /api/auth/forgot-password`
Gửi yêu cầu đặt lại mật khẩu qua email.

- **Quyền:** công khai

```json
{"email":"sv2026001@hcmut.edu.vn"}
```

**200 OK** — luôn trả cùng một kết quả để không tiết lộ email có tồn tại:

```json
{"error":false,"data":{"success":true},"message":"Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu."}
```

**Lỗi thường gặp:** `400` (email sai định dạng), `429` (đề xuất 3 lần/giờ/email).

#### `POST /api/auth/reset-password`
Đặt lại mật khẩu bằng token nhận từ email.

- **Quyền:** công khai

```json
{"token":"4f2a9c1d8b3e5a7f0c6d2e4b8a1f3c5d","password":"Abcd@1234"}
```

**200 OK**

```json
{"error":false,"data":{"success":true},"message":"Đặt lại mật khẩu thành công"}
```

**Lỗi thường gặp:** `400` (token hết hạn/đã dùng → `"Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn."`; mật khẩu sai chính sách).

#### `POST /api/auth/change-password`
Đổi mật khẩu của người dùng đang đăng nhập.

- **Quyền:** đã đăng nhập (mọi vai trò)

```json
{"currentPassword":"Abcd@1234","newPassword":"Xyz@9876"}
```

**200 OK**

```json
{"error":false,"data":{"success":true},"message":"Đổi mật khẩu thành công, vui lòng đăng nhập lại."}
```

**Lỗi thường gặp:** `400` (mật khẩu mới sai chính sách, hoặc mật khẩu mới trùng mật khẩu cũ), `401` `"Mật khẩu hiện tại không đúng."`.

#### `GET /api/auth/me`
Lấy hồ sơ người dùng đang đăng nhập (đọc từ token, không cần query DB nặng).

- **Quyền:** đã đăng nhập

**200 OK**

```json
{
  "error": false,
  "data": {"id":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","email":"sv2026001@hcmut.edu.vn","fullName":"Nguyễn Văn A","role":"student","status":"active","avatarUrl":null,"createdAt":"2026-09-26T08:15:30Z","updatedAt":"2026-09-26T08:15:30Z"},
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `401` (token hết hạn/không hợp lệ), `403` (tài khoản bị khoá hoặc đang bị khoá tạm).

### 5.4 Danh sách route công khai (DoD E1-T3)

`JwtAuthGuard` được đăng ký **toàn cục** nên **mặc định mọi route đều yêu cầu access token**; một route
chỉ công khai khi handler/controller có `@Public()`. Danh sách đầy đủ tại thời điểm E1:

| Route | Vì sao công khai |
|---|---|
| `GET /api` | Banner "service đang chạy", không trả dữ liệu nghiệp vụ |
| `GET /api/health` | Endpoint cho giám sát/uptime check — không thể đòi token |
| `POST /api/auth/register` | Người dùng chưa có tài khoản |
| `POST /api/auth/login` | Chính thông tin đăng nhập là bằng chứng |
| `POST /api/auth/refresh` | Bằng chứng là refresh token trong body |
| `POST /api/auth/forgot-password` | Người dùng đã quên mật khẩu, có thể không đăng nhập được |
| `POST /api/auth/reset-password` | Bằng chứng là token một lần trong email |

Mọi route khác (kể cả `POST /api/auth/logout`, `POST /api/auth/change-password`, `GET /api/auth/me`,
`GET|PATCH /api/users/me`, `GET /api/users`, `GET /api/users/:id`, `PATCH /api/users/:id/status`,
`PATCH /api/users/:id/role`) đều `401` nếu thiếu/sai token. Swagger UI tại
`/docs` do middleware phục vụ nên không đi qua guard.

> **Cập nhật E3 (2026-10-03) — CourseModule/LessonModule cố ý KHÔNG có route công khai:**
> danh sách trên là **nguồn chân lý duy nhất** cho "route nào công khai" (DoD của E1-T3) và nó
> **không** chứa route khoá học/chương/bài học/học liệu nào. Không controller nào của
> `CourseModule`/`LessonModule` có `@Public()`, kể cả các đường đọc như `GET /api/courses`,
> `GET /api/categories`, `GET /api/courses/:id`: **catalog cũng yêu cầu đăng nhập** (yêu cầu của E3).
> Đây là **sai lệch có chủ đích** so với bản đặc tả trước E3 — các dòng "**Quyền:** công khai" ở §7
> đã được sửa thành "đã đăng nhập" và ghi rõ lý do tại chỗ. Hệ quả: mọi route đó trả `401` khi thiếu
> token, và `403` khi token hợp lệ nhưng không đủ quyền **theo dữ liệu** (khoá `draft` của người
> khác, khoá `private`, bài chưa publish…).

---

## 6. Ma trận phân quyền (RBAC)

Quy tắc nền (theo `docs/architecture.md` mục 8 và `docs/proposal.md` mục 3.2):

- **Học viên (`student`)** chỉ xem và thao tác trên **dữ liệu của chính mình** (`userId`/`userId` lấy từ token, **không** nhận từ query/body).
- **Giảng viên (`teacher`)** chỉ xem/ghi dữ liệu thuộc **khoá học mình phụ trách**; truy cập ngoài phạm vi → `403 "Bạn không phụ trách khoá học này."`.
  - **Cập nhật E3 (2026-10-03):** "phụ trách" (**assigned**) được định nghĩa lại là
    **`courses.owner_id = currentUser.id` HOẶC tồn tại một dòng `course_instructors` với
    `user_id = currentUser.id`** (`CourseAccessService`). Bản cũ ghi `courses.teacherId` — trường đó
    **không tồn tại** trong schema (xem quyết định 1 ở đầu §7 CourseModule).
  - Một dòng `course_instructors` có `cohort_id` nghĩa là giảng viên chỉ phụ trách **lớp** đó, nhưng
    **ở E3 quyền nội dung vẫn áp cho cả khoá** vì chương/bài học không thuộc riêng lớp nào; phạm vi
    theo lớp được dùng từ **E8** khi lọc **dữ liệu học viên**.
  - `admin` **luôn** qua được mọi cửa kiểm tra quyền.
- **Quản trị viên (`admin`)** xem và cấu hình **toàn hệ thống**; mọi hành động quản trị ghi vào `audit_logs`.
- Ký hiệu: ✔ = được phép · ✖ = bị từ chối (`403`) · **own** = chỉ trên dữ liệu của chính mình · **assigned** = chỉ trên khoá/lớp mình phụ trách · **—** = không áp dụng (không cần token).

| Resource | Hành động | student | teacher | admin |
|---|---|---|---|---|
| `auth` | register, login, refresh, forgot-password, reset-password | — | — | — |
| `auth` | logout, change-password, `GET /auth/me` | ✔ | ✔ | ✔ |
| `users` | xem/sửa hồ sơ của mình (`/users/me`) | own | own | own |
| `users` | avatar của mình | own | own | own |
| `users` | danh sách/chi tiết người dùng | ✖ | ✖ | ✔ |
| `users` | tạo/sửa/xoá người dùng (`POST`, `PATCH /:id` không phải `status`/`role`, `DELETE`) | ✖ | ✖ | ✔ |
| `users` | khoá/mở tài khoản, đổi vai trò | ✖ | ✖ | ✔ |
| `categories` | đọc danh mục | ✔ | ✔ | ✔ |
| `categories` | CRUD danh mục | ✖ | ✖ | ✔ |
| `courses` | xem danh sách/chi tiết khoá đã publish (không `private`) | ✔ | ✔ | ✔ |
| `courses` | xem khoá `draft`/`hidden`/`archived` | ✖ | assigned | ✔ |
| `courses` | tạo khoá học | ✖ | ✔ | ✔ |
| `courses` | sửa/xoá khoá học (đổi `ownerId` chỉ `admin`) | ✖ | assigned | ✔ |
| `courses` | publish/unpublish | ✖ | assigned | ✔ |
| `course_instructors` | xem danh sách giảng viên của khoá (`assertCanView`) | ✔ (khoá `published`, không `private`) | ✔ (khoá `published`), assigned (mọi trạng thái) | ✔ |
| `course_instructors` | phân công / gỡ phân công | ✖ | assigned | ✔ |
| `course_instructors` | gỡ dòng `owner` (chủ sở hữu chính) | ✖ | ✖ (kể cả assigned — `400`) | ✖ (`400`; đổi chủ qua `PATCH /api/courses/:id`) |
| `cohorts` | xem lớp của khoá (`assertCanView`) | ✔ (khoá `published`, không `private`) | ✔ (khoá `published`), assigned (mọi trạng thái) | ✔ |
| `cohorts` | tạo/sửa/xoá lớp | ✖ | assigned | ✔ |
| `course_prerequisites` | xem (nằm trong chi tiết khoá, theo quyền xem khoá) | ✔ (kèm khoá được xem) | ✔ (kèm khoá được xem) | ✔ |
| `course_prerequisites` | thay danh sách tiên quyết (`PUT`) | ✖ | assigned | ✔ |
| `course_sections` | đọc chương của khoá (`assertCanView`) | ✔ (khoá `published`, không `private`) | ✔ (khoá `published`), assigned (mọi trạng thái) | ✔ |
| `course_sections` | CRUD + reorder chương | ✖ | assigned | ✔ |
| `lessons` | danh sách bài học của khoá (`GET /api/courses/:courseId/lessons`) | ✔ (khoá `published` + không `private`; chỉ thấy bài đã publish) | ✔ (khoá `published`), assigned (mọi trạng thái) | ✔ |
| `lessons` | chi tiết một bài học (`GET /api/lessons/:id`) | own — **ba** điều kiện, xem ghi chú dưới bảng | assigned | ✔ |
| `lessons` | CRUD + reorder + publish/hide bài học | ✖ | assigned | ✔ |
| `lesson_materials` | đọc/tải học liệu | own (cùng quy tắc với `GET /api/lessons/:id`) | assigned | ✔ |
| `lesson_materials` | upload/xoá học liệu | ✖ | assigned | ✔ |
| `enrollments` | ghi danh cho chính mình (`POST /api/enrollments` — **lát cắt đã làm ở E3-T7**) | own (chỉ khoá `published`, không `private`, `enrollmentOpen`, đủ tiên quyết, chưa đầy) | ✖ | ✔ (body chỉ có `courseId`/`cohortId`, **không** nhận `userId`) |
| `enrollments` | huỷ ghi danh (`DELETE /api/enrollments/:id`) | own | ✖ | ✔ |
| `enrollments` | danh sách ghi danh | own | assigned (có lọc `cohort_id`) | ✔ |
| `lesson_progress` | đánh dấu/bỏ hoàn thành (`POST|DELETE /api/lessons/:id/complete`) | own | ✖ | ✖ |
| `lesson_progress` | xem tiến độ học viên khác | ✖ | assigned | ✔ |
| `quizzes` | làm quiz (bắt đầu lượt, nộp bài) | own | ✖ | ✔ |
| `quizzes` | đọc quiz đã publish | ✔ | assigned | ✔ |
| `quizzes` | CRUD quiz + câu hỏi + đáp án | ✖ | assigned | ✔ |
| `submissions` | nộp bài, xem kết quả + xem lại lỗi của mình | own | ✖ | ✔ |
| `submissions` | xem danh sách bài nộp của khoá | ✖ | assigned | ✔ |
| `submissions` | cho điểm/phản hồi thủ công | ✖ | assigned | ✔ |
| `discussion_threads` / `discussion_posts` | đọc, tạo thread, trả lời | ✔ | ✔ | ✔ |
| `discussion_threads` / `discussion_posts` | sửa/xoá bài của mình | own | own | own |
| `discussion_posts` | sửa/xoá bài của người khác (kiểm duyệt) | ✖ | assigned | ✔ |
| `content_reports` | tạo báo cáo vi phạm | ✔ | ✔ | ✔ |
| `content_reports` | xem/duyệt/từ chối báo cáo | ✖ | ✖ | ✔ |
| `learning_events` | gửi lô sự kiện | own | own | own |
| `learning_events` | đọc log sự kiện thô | ✖ | ✖ | ✔ |
| `risk_predictions` | xem rủi ro của chính mình | own | ✖ | ✔ |
| `risk_predictions` | xem rủi ro học viên trong khoá | ✖ | assigned | ✔ |
| `risk_predictions` | kích hoạt job dự đoán | ✖ | assigned | ✔ |
| `ai_jobs` | xem trạng thái job mình tạo | own | own | ✔ |
| `ai_jobs` | xem toàn bộ job, `GET /ai/models` | ✖ | ✖ | ✔ |
| `analytics` | dashboard khoá học | ✖ | assigned | ✔ |
| `analytics` | dashboard của chính mình (`/analytics/me/overview`) | own | ✖ | ✔ |
| `interventions` | tạo can thiệp cho học viên trong khoá | ✖ | assigned | ✔ |
| `interventions` | xem can thiệp của chính mình | own | ✖ | ✔ |
| `interventions` | cập nhật trạng thái can thiệp | ✖ | assigned | ✔ |
| `notifications` | danh sách/đánh dấu đã đọc/cấu hình của mình | own | own | own |
| `alert_settings` | xem/cấu hình ngưỡng cảnh báo | ✖ | ✖ | ✔ |
| `audit_logs` | xem log hành động | ✖ | ✖ | ✔ |
| `admin` | thống kê tổng quan hệ thống | ✖ | ✖ | ✔ |

> **Chú thích "own" của `lessons`/`lesson_materials` (E3, 2026-10-03):** với `student`, quyền xem
> **không** chỉ là "bài đã publish" mà là **ba** điều kiện cùng lúc: (a) khoá `published` và không
> `private`, (b) bài `is_published = true` và chưa xoá mềm, (c) có dòng `enrollments` với
> `status IN ('active','completed')`. Thiếu bất kỳ điều kiện nào → `403`. `GET /api/lessons/:id` và
> `GET /api/lessons/:id/materials` dùng **chung một** hàm kiểm tra (`assertLessonViewable`).
> Lưu ý khác biệt có chủ đích: đường **danh sách** (`GET /api/courses/:courseId/sections`,
> `GET /api/courses/:courseId/lessons`) chỉ qua `CourseAccessService.canView` (khoá `published` +
> không `private`) — học viên **chưa** ghi danh vẫn xem được mục lục, nhưng mở chi tiết bài thì `403`.
>
> **Chú thích "assigned" của CourseModule (E3):** "assigned" = chủ sở hữu **hoặc** có dòng
> `course_instructors` (bất kể `cohort_id`); xem định nghĩa đầy đủ ở đầu mục này. `admin` luôn ✔.

**Cơ chế thực thi (đề xuất triển khai):** `JwtAuthGuard` (global, có `@Public()` để mở ngoại lệ) + `RolesGuard` đọc metadata `@Roles('teacher')`; kiểm tra "own/assigned" làm ở **tầng service** vì cần dữ liệu, không chỉ metadata — mọi truy vấn của teacher **bắt buộc** có điều kiện `course.owner_id = :currentUserId` **hoặc** `EXISTS (course_instructors …)`, mọi truy vấn của student **bắt buộc** có `userId = :currentUserId`.

> **Cập nhật E3 (2026-10-03):** phần cơ chế trên **đã được triển khai đúng như vậy**, chỉ khác chi
> tiết: điều kiện "assigned" là `courses.owner_id = user.id` **hoặc** một dòng `course_instructors`
> (không phải `courses.teacherId` — trường đó không tồn tại). Nơi thực thi duy nhất:
> `backend/src/course/course-access.service.ts` (`canManage`/`assertCanManage`/`canView`/
> `assertCanView`/`applyVisibilityScope`), được `CourseModule` và `LessonModule` **bắt buộc** đi qua.
> `applyVisibilityScope` còn là nơi áp phạm vi cho `GET /api/courses`: `admin` không thêm điều kiện,
> `teacher` thấy khoá `published` **hoặc** khoá mình phụ trách (mọi trạng thái), `student` chỉ thấy
> khoá `published` và không `private`.

---

## 7. Danh sách endpoint theo module

Quy ước chung cho mọi mục dưới đây:

- Response thành công luôn bọc envelope; các ví dụ dưới đây ghi **đầy đủ envelope** ở endpoint đầu tiên của mỗi module và **rút gọn phần `"message": "Thành công"`** ở các endpoint sau khi message không có gì đặc biệt. Mọi endpoint đều trả đủ ba khoá.
- `401` (thiếu/hết hạn token) và `403` (sai vai trò) áp dụng cho **mọi** endpoint có quyền khác "công khai" — không lặp lại ở từng mục, chỉ ghi lỗi **đặc thù**.
- Mọi danh sách trả `{ items, meta }` theo mục 3.4 — **trừ** ba endpoint chỉ trả `{ items }` (không `meta`):
  `GET /api/courses/:id/instructors`, `GET /api/courses/:id/cohorts`, `PUT /api/courses/:id/prerequisites`
  (E3, 2026-10-03). Chi tiết và ngoại lệ thứ hai (`sections`/`materials` vẫn có `meta` nhưng mặc định
  `take` khác 20) ở bổ sung cuối §3.4.

### AuthModule (`/api/auth`)

Đã đặc tả đầy đủ tại **mục 5.3** (8 endpoint): `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `POST /forgot-password`, `POST /reset-password`, `POST /change-password`, `GET /me`.

### UserModule (`/api/users`)

> **Trạng thái (2026-10-03):** `GET /users/me`, `PATCH /users/me` (E2-T1), `GET /users`, `PATCH /users/:id/role`
> (E2-T2) và `PATCH /users/:id/status` (E1-T5) **đã có trong code**. `POST /users`, `DELETE /users/:id`,
> `POST|DELETE /users/me/avatar` và `summary` trong hồ sơ vẫn là đặc tả đích — chưa thuộc task nào của E2
> (avatar sẽ đi cùng cơ chế upload của E3-T4, `summary` cần `enrollments`/`submissions` của E4/E5).
> `GET /users/:id` trả **hồ sơ đầy đủ** (`UserDetail`: thêm `phone`, `major`, `bio`, `studentCode`,
> `dateOfBirth`) cho chính chủ hoặc admin — E1 chỉ trả 8 trường vì khi đó chưa có E2-T1.

#### `GET /api/users/me`
Lấy hồ sơ đầy đủ của người dùng đang đăng nhập (kèm thống kê tóm tắt theo vai trò).

- **Quyền:** đã đăng nhập (own)

**200 OK**

```json
{
  "error": false,
  "data": {"id":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","email":"sv2026001@hcmut.edu.vn","fullName":"Nguyễn Văn A","role":"student","status":"active","studentCode":"SV2026001","phone":"0901234567","major":"Khoa học máy tính","avatarUrl":"https://cdn.uniprep.local/avatars/8f2a1b3c.webp","bio":null,"summary":{"enrolledCourses":3,"completedLessons":24,"averageScore":7.85},"createdAt":"2026-09-26T08:15:30Z","updatedAt":"2026-09-26T10:02:11Z"},
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `401`.

#### `PATCH /api/users/me`
Cập nhật hồ sơ cá nhân (không cho đổi `email`, `role`, `status` — các field lạ bị `whitelist` loại bỏ).

- **Quyền:** đã đăng nhập (own)

```json
{"fullName":"Nguyễn Văn An","phone":"0907654321","major":"Kỹ thuật phần mềm","bio":"Sinh viên năm 3"}
```

**200 OK** — trả object hồ sơ như `GET /api/users/me`.

**Lỗi thường gặp:** `400` (sai định dạng `phone`/độ dài `fullName`).

**Ràng buộc đã chốt ở E2-T1:** mọi trường đều tuỳ chọn, chỉ trường nào client gửi lên mới được ghi;
gửi `null` để **xoá** `phone`/`major`/`bio`. `fullName` 2–255 ký tự, `phone` khớp
`^(?:\+84|0)\d{9}$`, `major` ≤ 255, `bio` ≤ 1000 — message lỗi tiếng Việt lấy từ chính DTO
(`"Số điện thoại không hợp lệ (ví dụ: 0901234567)."`). Chuỗi gửi lên được **trim** trước khi kiểm tra.

#### `POST /api/users/me/avatar` **(đề xuất)**
Tải ảnh đại diện lên (multipart, field `file`).

- **Quyền:** đã đăng nhập (own)
- **Giới hạn (đề xuất):** tối đa **2 MB**; chấp nhận `image/jpeg`, `image/png`, `image/webp`; ảnh được resize vuông 256×256 và lưu dưới dạng `.webp`

```http
POST /api/users/me/avatar HTTP/1.1
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data; boundary=----X

------X
Content-Disposition: form-data; name="file"; filename="avatar.png"
Content-Type: image/png

<binary>
------X--
```

**200 OK**

```json
{"error":false,"data":{"avatarUrl":"https://cdn.uniprep.local/avatars/8f2a1b3c.webp"},"message":"Cập nhật ảnh đại diện thành công"}
```

**Lỗi thường gặp:** `400` (không có file), `413` (vượt 2 MB), `415` (sai định dạng).

#### `DELETE /api/users/me/avatar` **(đề xuất)**
Xoá ảnh đại diện, đưa `avatarUrl` về `null`.

- **Quyền:** đã đăng nhập (own)

**200 OK** — `{ "error": false, "data": { "avatarUrl": null }, "message": "Đã xoá ảnh đại diện" }`

**Lỗi thường gặp:** `404` (chưa có avatar).

#### `GET /api/users`
Danh sách người dùng toàn hệ thống (dành cho quản trị).

- **Quyền:** `admin`
- **Query:** `page`, `take`, `search` (khớp `email`, `fullName`, `studentCode`), `sortBy` (`createdAt`\|`fullName`\|`email`), `order`, `role` (`student,teacher,admin`), `status` (`pending,active,suspended,disabled`)

```http
GET /api/users?role=teacher&status=active&search=nguyen&page=1&take=20&sortBy=fullName&order=asc
```

**200 OK**

```json
{
  "error": false,
  "data": {"items":[{"id":"1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d","email":"gv001@hcmut.edu.vn","fullName":"Trần Thị B","role":"teacher","status":"active","avatarUrl":null,"createdAt":"2026-09-21T03:00:00Z","updatedAt":"2026-09-25T07:20:00Z"}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `400` (`role`/`status` ngoài union), `403`.

**Ràng buộc đã chốt ở E2-T2:** mặc định `page=1`, `take=20`; `take` **tối đa 100** và `page` **tối thiểu 1**
(vi phạm → `400`, không âm thầm cắt bớt — nếu không có trần thì `?take=1000000` là một cách tự DoS bằng
một request hợp lệ). `sortBy` nằm trong **danh sách trắng** vì tên cột không tham số hoá được trong
`ORDER BY`; truy vấn luôn thêm khoá phụ `id` để thứ tự giữa hai trang ổn định (nếu không, bản ghi có thể
xuất hiện hai lần hoặc bị bỏ sót khi lật trang). Bản ghi đã xoá mềm (`deleted_at IS NOT NULL`) không bao
giờ xuất hiện. `meta` theo đúng §3.4: `itemCount` là **tổng số bản ghi khớp điều kiện** (frontend truyền
thẳng vào `pagination.total` của antd) và `pageCount = max(1, ceil(itemCount / take))`.

> **Cạm bẫy đã gặp ở E2-T5 (ghi lại để không lặp):** các **ví dụ JSON** trong tài liệu này luôn có
> `"itemCount":1` vì chúng minh hoạ danh sách một phần tử, trông y như "số dòng của trang hiện tại".
> Bản cài đặt đầu tiên hiểu theo nghĩa đó ⇒ bảng quản trị người dùng chỉ hiện **một** trang và không cách
> nào lật sang trang 2. Định nghĩa ở interface §3.4 mới là nguồn chân lý: `itemCount` là **tổng**.

#### `POST /api/users`
Quản trị tạo người dùng mới với vai trò tuỳ chọn.

- **Quyền:** `admin`

```json
{"email":"gv002@hcmut.edu.vn","password":"Abcd@1234","fullName":"Lê Văn C","role":"teacher","status":"active"}
```

**201 Created** — trả object người dùng (không kèm token).

**Lỗi thường gặp:** `409` `"Email này đã được sử dụng."`, `400`.

#### `GET /api/users/:id`
Chi tiết một người dùng.

- **Quyền:** `admin`

**200 OK** — object người dùng kèm `summary` như `GET /api/users/me`.

**Lỗi thường gặp:** `404` `"Không tìm thấy người dùng với ID <uuid>"`, `400` (`:id` không phải UUID).

#### `PATCH /api/users/:id`
Quản trị cập nhật thông tin người dùng (họ tên, điện thoại, ngành, `status`).

- **Quyền:** `admin`

```json
{"fullName":"Lê Văn Cường","phone":"0912345678","status":"active"}
```

**200 OK** — object người dùng sau cập nhật.

**Lỗi thường gặp:** `404`, `400`. Mọi thay đổi ghi `audit_logs` (đề xuất).

#### `DELETE /api/users/:id`
Xoá người dùng (khuyến nghị: **soft delete** bằng `status = 'locked'` nếu đã có dữ liệu học tập).

- **Quyền:** `admin`

**200 OK** — `{ "error": false, "data": { "success": true }, "message": "Đã xoá người dùng" }`

**Lỗi thường gặp:** `404`, `409` `"Không thể xoá người dùng đã có dữ liệu học tập."`, `403` (tự xoá chính mình → `"Bạn không thể xoá tài khoản của chính mình."`).

#### `PATCH /api/users/:id/status`
Khoá hoặc mở khoá tài khoản.

- **Quyền:** `admin`

```json
{"status":"locked","reason":"Vi phạm quy định diễn đàn"}
```

**200 OK** — `{ "error": false, "data": { "id": "...", "status": "locked", "updatedAt": "2026-09-26T10:30:00.000Z" }, "message": "Đã khoá tài khoản" }`

**Lỗi thường gặp:** `400` (`status` ngoài `active|locked`), `404`, `403` (khoá chính mình).

> **Thực tế đã làm ở E1-T5 (khác đặc tả trên):** tập `status` là union của DB
> `pending | active | suspended | disabled` (chữ "locked" trong ví dụ trên được hiểu là nhóm *không đăng
> nhập được*), trường `reason` **chưa** có trong DTO (sẽ đi cùng `audit_logs` ở E12-T1), response trả
> **hồ sơ đầy đủ** thay vì `{id,status,updatedAt}`, và khi chuyển khỏi `active` server **thu hồi mọi
> phiên** ngay. Tự khoá chính mình → `400` `"Bạn không thể khoá hoặc vô hiệu hoá tài khoản của chính mình."`

#### `PATCH /api/users/:id/role`
Đổi vai trò người dùng.

- **Quyền:** `admin`

```json
{"role":"teacher"}
```

**200 OK** — `{ "error": false, "data": { "id": "...", "role": "teacher", "updatedAt": "..." }, "message": "Đã cập nhật vai trò" }`

**Lỗi thường gặp:** `400` (`role` ngoài union), `404`, `403` (tự hạ vai trò `admin` của chính mình — đề xuất chặn để không mất quyền quản trị cuối cùng).

> **Đã làm ở E2-T2 (2026-10-03):** tự hạ vai trò chính mình → **`400`**
> `"Bạn không thể tự hạ vai trò quản trị viên của chính mình."` (không phải `403`; người gọi đúng là
> admin, cái sai nằm ở tham số). Response trả hồ sơ đầy đủ. Đổi vai trò **có hiệu lực ngay** với request
> kế tiếp vì `JwtStrategy` đọc `role` từ DB chứ không tin claim trong token; server **thu hồi refresh
> token** để trình duyệt buộc đăng nhập lại và nhận đúng vai trò mới (menu/route phía FE), nhưng **không**
> thu hồi khi vai trò gửi lên trùng giá trị cũ (thao tác lặp lại không được đăng xuất người dùng).

### CourseModule — danh mục & khoá học (`/api/categories`, `/api/courses`)

> `docs/architecture.md` liệt kê `CourseModule`; danh mục (`categories`) nằm trong cùng module này. Tách thành `CategoryModule` riêng là **(đề xuất)**.

> **E3 — chốt ngày 2026-10-03 (đọc mục này trước, không phải diff hai tài liệu):**
> Phần `CourseModule`/`LessonModule` dưới đây đã được viết lại theo **mã nguồn đã chạy** ở
> `UniPrep/backend`. Năm quyết định đã chốt:
>
> 1. **Đặt tên: `database-design.md` thắng các ví dụ JSON cũ của tài liệu này.** Khoá học trả
>    `title`, `summary`, `description`, `owner` (`{id, fullName, email}`), `coverUrl`, `level`,
>    `visibility`, `language`, `estimatedHours`, `enrollmentOpen`, `maxStudents`, `semester`.
>    **Không** có `name`, `teacherId` hay `thumbnailUrl` ở bất kỳ endpoint nào, và tham số lọc danh
>    sách là **`ownerId`** (không phải `teacherId`).
> 2. **Nội dung bài học: `database-design.md` thắng.** `lessons` có `content` + `contentFormat`
>    (**không** có `type`, `videoUrl`, `durationSeconds`). Video/slide/tệp/link/văn bản nằm ở
>    `lesson_materials` (`materialType`, `url`, `content`, `durationSeconds`, `mimeType`,
>    `fileSizeBytes`). Response bài học mang thêm `derivedType` **suy diễn** (`video` nếu có học liệu
>    video, ngược lại `slide`, ngược lại `file`, ngược lại `text`; học liệu `link` **không** nâng
>    loại) — **không phải** cột lưu trong DB, chỉ để hiển thị.
> 3. **`course_instructors` và `cohorts` được tạo ở E3** (E2-T3 chuyển sang E3). "Được phân công"
>    (**assigned**) nay nghĩa là `courses.owner_id = user.id` **HOẶC** có một dòng
>    `course_instructors` cho user đó; `admin` luôn qua. Một dòng `course_instructors` có `cohort_id`
>    nghĩa là giảng viên chỉ phụ trách **lớp** đó, nhưng **ở E3 quyền nội dung vẫn áp cho cả khoá**
>    (chương/bài học không thuộc riêng lớp nào); phạm vi theo lớp để dành cho việc lọc **dữ liệu học
>    viên** ở E8.
> 4. **Điều kiện tiên quyết có cấu trúc:** bảng mới `course_prerequisites` (`database-design.md`
>    §3.2.8). "Đã đạt" = người gọi có dòng `enrollments` với `status = 'completed'` cho khoá tiên
>    quyết. `GET /api/courses/:id` trả `prerequisites` và `eligibility`
>    (`{ eligible, reason, missing, prerequisites }`), và `POST /api/enrollments` **thực thi** đúng
>    quy tắc đó — **một** nơi cài đặt duy nhất: `CourseEligibilityService`. `eligibility` là `null`
>    với `teacher`/`admin`.
> 5. **Endpoint catalog yêu cầu đăng nhập** (không `@Public()`): danh sách route công khai có thẩm
>    quyền là §5.4 (DoD của E1-T3) và **không** có route khoá học. Vì vậy mọi dòng
>    "**Quyền:** công khai" trong `CourseModule`/`LessonModule` của bản cũ đã được sửa ở tài liệu này.
>    Đây là **sai lệch có chủ đích** so với bản đặc tả trước E3 (lý do: yêu cầu của E3).
>
> **Các sai lệch khác đã ghi nhận (không phải lỗi, là chủ đích):** `GET /api/courses/:id` **không**
> nhúng `sections` (FE gọi thêm `GET /api/courses/:courseId/sections` / `…/lessons`); `take` bị chặn
> trần 100; `POST /api/lessons/:id/materials` chạy `multipart/form-data`; `DELETE /api/lessons/:id` và
> `DELETE /api/sections/:id` trả `409` khi đã có bài làm/tiến độ. Chi tiết ở từng endpoint.

#### `GET /api/categories`
Danh sách danh mục (khoa/bộ môn) — dùng cho dropdown lọc khoá học.

- **Quyền:** đã đăng nhập (mọi vai trò). **Không** công khai — xem quyết định 5 ở đầu mục và §5.4.
- **Query:** `page`, `take` (trần **100**), `search` (khớp `name`, `slug` — `LOWER(...) LIKE`), `sortBy` (`name`\|`createdAt`, mặc định **`name`**), `order`

**200 OK**

```json
{
  "error": false,
  "data": {"items":[{"id":"c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f","name":"Khoa học máy tính","slug":"khoa-hoc-may-tinh","description":"Các khoá học thuộc khoa KHMT","parentId":null,"orderIndex":0,"isActive":true,"courseCount":12,"createdAt":"2026-09-20T02:00:00Z","updatedAt":"2026-09-20T02:00:00Z"}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

> `courseCount` là **tổng** số khoá học chưa xoá mềm thuộc danh mục, tính bằng **một** truy vấn gộp
> `GROUP BY category_id` cho cả trang (không N+1).

**Lỗi thường gặp:** `400` (query sai, `take > 100`).

#### `POST /api/categories`
Tạo danh mục mới.

- **Quyền:** `admin`

```json
{"name":"Toán ứng dụng","slug":"toan-ung-dung","description":"Khoá học toán cho kỹ thuật","parentId":null,"orderIndex":0,"isActive":true}
```

| Field | Bắt buộc | Ràng buộc |
|---|---|---|
| `name` | ✔ | chuỗi, không rỗng (duy nhất, không phân biệt hoa/thường) |
| `slug` | ✖ | bỏ trống thì backend sinh từ `name`; trùng thì thêm hậu tố |
| `description` | ✖ | `string \| null` |
| `parentId` | ✖ | UUID v4 của danh mục cha, hoặc `null` |
| `orderIndex` | ✖ | số nguyên, mặc định `0` |
| `isActive` | ✖ | boolean, mặc định `true` |

**201 Created** — trả object danh mục.

**Lỗi thường gặp:** `409` `"Danh mục này đã tồn tại."` (trùng `name` **hoặc** `slug`), `404` (`parentId` không tồn tại), `400`.

#### `GET /api/categories/:id`
Chi tiết danh mục kèm số khoá học.

- **Quyền:** đã đăng nhập (mọi vai trò)

**200 OK** — object danh mục như trong danh sách.

**Lỗi thường gặp:** `404` `"Không tìm thấy danh mục với ID <uuid>"`.

#### `PATCH /api/categories/:id`
Cập nhật danh mục.

- **Quyền:** `admin`

```json
{"name":"Toán ứng dụng và Thống kê"}
```

**200 OK** — object danh mục sau cập nhật.

**Lỗi thường gặp:** `404`, `409` `"Danh mục này đã tồn tại."` (trùng `name`/`slug`, hoặc **đặt `parentId` = chính nó** — sẽ tạo vòng trong cây phân cấp), `400`.

#### `DELETE /api/categories/:id`
Xoá danh mục (chỉ khi không còn khoá học tham chiếu).

- **Quyền:** `admin`

**200 OK** — `{ "error": false, "data": { "success": true }, "message": "Đã xoá danh mục" }`

**Lỗi thường gặp:** `404`, `409` `"Không thể xoá danh mục đang có khoá học."`.

> Xoá là **xoá cứng**, nhưng bị chặn khi còn khoá học tham chiếu: FK `courses.category_id` là
> `ON DELETE SET NULL` nên nếu cho xoá thì phân loại của hàng loạt khoá học sẽ **âm thầm** biến mất.

#### `GET /api/courses`
Danh sách khoá học có tìm kiếm, lọc và phân trang.

- **Quyền:** đã đăng nhập. Phạm vi **không** nhận từ query mà do vai trò trong token quyết định
  (`CourseAccessService.applyVisibilityScope`): `student` chỉ thấy khoá `status = 'published'` và
  `visibility <> 'private'`; `teacher` thấy khoá `published` **hoặc** khoá mình phụ trách (mọi trạng
  thái); `admin` thấy tất cả (kể cả `draft`/`archived`).
- **Query:**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `search` | string | Khớp `title`, `code`, `summary` (`LOWER(...) LIKE`; `summary` được `COALESCE` về `''`) |
| `categoryId` | uuid | Lọc theo danh mục |
| `status` | `draft,published,hidden,archived` | Nhiều giá trị phân tách bằng dấu phẩy (gửi lặp tham số cũng được) |
| `semester` | string | Ví dụ `1/2026-2027` |
| `ownerId` | uuid | Lọc theo **giảng viên phụ trách chính** (`courses.owner_id`) |
| `level` | `beginner`\|`intermediate`\|`advanced` | Lọc theo trình độ |
| `page`, `take` | number | Phân trang; `take` trần **100**, mặc định `20` |
| `sortBy` | `createdAt`\|`title`\|`code`\|`enrolledCount` | Mặc định `createdAt` |
| `order` | `asc`\|`desc` | Mặc định `desc` |

> **Thay thế (E3, 2026-10-03):** bảng cũ ghi `search` khớp `name`/`description`, `teacherId`, và
> `sortBy` nhận `name`. Không trường nào trong số đó tồn tại — xem quyết định 1 ở đầu mục.
> `enrolledCount` sắp theo số học viên **chưa** huỷ ghi danh (`status <> 'dropped'`); mọi truy vấn
> đều thêm khoá phụ `id` để phân trang ổn định.

```http
GET /api/courses?categoryId=c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f&status=published&semester=1%2F2026-2027&level=beginner&page=1&take=20&sortBy=title&order=asc
```

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": [
      {
        "id": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
        "code": "CS101",
        "title": "Nhập môn lập trình",
        "slug": "nhap-mon-lap-trinh",
        "summary": "Khoá học nền tảng về lập trình và tư duy thuật toán.",
        "status": "published",
        "visibility": "public",
        "level": "beginner",
        "semester": "1/2026-2027",
        "coverUrl": null,
        "category": {"id":"c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f","name":"Khoa học máy tính","slug":"khoa-hoc-may-tinh"},
        "owner": {"id":"1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d","fullName":"Trần Thị B","email":"b.tran@hcmut.edu.vn"},
        "sectionCount": 5,
        "lessonCount": 32,
        "enrolledCount": 148,
        "myEnrollment": null,
        "createdAt": "2026-09-20T02:00:00Z",
        "updatedAt": "2026-09-24T09:30:00Z"
      }
    ],
    "meta": {"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}
  },
  "message": "Thành công"
}
```

> **`meta.itemCount` là TỔNG số bản ghi khớp điều kiện** (không phải số dòng của trang) và
> `pageCount = max(1, ceil(itemCount / take))` — đây là **bẫy đã ghi nhận từ E2**: nếu trả số dòng
> của trang thì bảng phân trang phía FE chỉ hiện đúng một trang. `myEnrollment` (`{id, status,
> progressPercent, enrolledAt, completedAt}` hoặc `null`) là trạng thái ghi danh của **người đang
> gọi**, có mặt ở cả danh sách lẫn chi tiết để catalog hiển thị "Đã đăng ký" mà không phải gọi thêm API.

**Lỗi thường gặp:** `400` (`status` ngoài union, `categoryId`/`ownerId` không phải UUID v4, `take > 100`, `sortBy` ngoài whitelist).

#### `POST /api/courses`
Tạo khoá học mới.

- **Quyền:** `teacher`, `admin`. `teacher` luôn trở thành chủ sở hữu khoá mình tạo (`ownerId` trong
  body bị **bỏ qua**, không phải `400`, vì FE dùng chung một form cho cả hai vai trò); `admin` **phải**
  chỉ định `ownerId` là một người dùng vai trò `teacher` đang hoạt động.

```json
{
  "code": "CS102",
  "title": "Cấu trúc dữ liệu và giải thuật",
  "summary": "Danh sách, cây, đồ thị và phân tích độ phức tạp.",
  "description": "Đề cương chi tiết...",
  "categoryId": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  "semester": "1/2026-2027",
  "ownerId": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "coverUrl": null,
  "level": "intermediate",
  "visibility": "public",
  "language": "vi",
  "estimatedHours": 45,
  "enrollmentOpen": true,
  "maxStudents": null
}
```

| Field | Bắt buộc | Ràng buộc |
|---|---|---|
| `code` | ✔ | 2–50 ký tự, chỉ `[A-Za-z0-9._-]`, duy nhất (không phân biệt hoa/thường) |
| `title` | ✔ | 3–255 ký tự |
| `slug` | ✖ | tối đa 280; bỏ trống thì sinh từ `title` |
| `summary` | ✖ | tối đa 500 ký tự (`string \| null`) |
| `description` | ✖ | tối đa 20000 ký tự (`string \| null`) |
| `categoryId` | ✖ | UUID v4 tồn tại, hoặc `null` |
| `ownerId` | ✖ | UUID v4, vai trò `teacher`. **Bắt buộc** khi người gọi là `admin`; bị bỏ qua khi là `teacher` |
| `coverUrl` | ✖ | tối đa 512 ký tự |
| `level` | ✖ | `beginner`\|`intermediate`\|`advanced` |
| `visibility` | ✖ | `public` (mặc định)\|`unlisted`\|`private` |
| `language` | ✖ | tối đa 10 ký tự, mặc định `vi` |
| `semester` | ✖ | tối đa 20 ký tự |
| `estimatedHours` | ✖ | số nguyên ≥ 0 (cột DB là `numeric(5,1)`) |
| `enrollmentOpen` | ✖ | boolean, mặc định `true` |
| `maxStudents` | ✖ | số nguyên ≥ 1; `null` = không giới hạn |

> **Thay thế (E3, 2026-10-03):** bảng cũ ghi `name` (3–200), `description` ≤ 5000, `teacherId`,
> `thumbnailUrl`, và `categoryId` bắt buộc. Theo quyết định 1, tên đúng là `title`/`summary`/
> `description`/`ownerId`/`coverUrl`, và `categoryId` là **tuỳ chọn** (bỏ trống = chưa phân loại).
> **Không có `status`** trong body: mọi khoá học mới bắt đầu ở `draft` để không thể tạo khoá đã
> `published` mà chưa có bài học nào (công bố qua `PATCH /:id/publish`).
> Trong **cùng transaction**, backend ghi thêm một dòng `course_instructors` với
> `roleInCourse = 'owner'` cho chủ sở hữu — nếu thiếu dòng đó thì RBAC tầng truy vấn (E8) sẽ không
> thấy chủ sở hữu nào cho khoá.

**201 Created** — trả **object chi tiết** khoá học (`CourseDetail`, xem `GET /api/courses/:id`);
`status` luôn là `'draft'` và `publishedAt` là `null`.

**Lỗi thường gặp:** `409` `"Mã khoá học này đã được sử dụng."` (hoặc `"Đường dẫn (slug) này đã được sử dụng."`), `404` `"Không tìm thấy danh mục với ID <uuid>"`, `400` `"Không tìm thấy giảng viên phụ trách."` / `"Người phụ trách khoá học phải có vai trò giảng viên."`, `403` (`student`).

#### `GET /api/courses/:id`
Chi tiết khoá học kèm giảng viên, điều kiện tiên quyết và (với `student`) cờ đủ điều kiện ghi danh.

- **Quyền:** đã đăng nhập. `admin` luôn xem được; `teacher` phải **được phân công** (chủ sở hữu hoặc
  có dòng `course_instructors`); `student` chỉ xem được khoá `status = 'published'` và
  `visibility <> 'private'`. Khoá tồn tại nhưng không đủ điều kiện → `403 "Khoá học này chưa được công bố."`
  (không phải `404`, để FE phân biệt "chưa công bố" với "gõ sai ID").

**200 OK**

```json
{
  "error": false,
  "data": {
    "id": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
    "code": "CS101",
    "title": "Nhập môn lập trình",
    "slug": "nhap-mon-lap-trinh",
    "summary": "Khoá học nền tảng về lập trình và tư duy thuật toán.",
    "description": "Đề cương chi tiết...",
    "status": "published",
    "visibility": "public",
    "level": "beginner",
    "semester": "1/2026-2027",
    "coverUrl": null,
    "category": {"id":"c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f","name":"Khoa học máy tính","slug":"khoa-hoc-may-tinh"},
    "owner": {"id":"1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d","fullName":"Trần Thị B","email":"b.tran@hcmut.edu.vn"},
    "sectionCount": 5,
    "lessonCount": 32,
    "enrolledCount": 148,
    "myEnrollment": {"id":"d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70","status":"active","progressPercent":45.5,"enrolledAt":"2026-09-22T04:00:00Z","completedAt":null},
    "language": "vi",
    "estimatedHours": 45,
    "enrollmentOpen": true,
    "maxStudents": null,
    "publishedAt": "2026-09-21T02:00:00Z",
    "prerequisites": [
      {"id":"c9d0e1f2-a3b4-4c5d-8e6f-7a8b9c0d1e2f","code":"CS100","title":"Nhập môn tin học","isSatisfied":true}
    ],
    "eligibility": {"eligible":true,"reason":null,"missing":[],"prerequisites":[{"id":"c9d0e1f2-a3b4-4c5d-8e6f-7a8b9c0d1e2f","code":"CS100","title":"Nhập môn tin học","isSatisfied":true}]},
    "instructors": [
      {"id":"7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d","userId":"1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d","fullName":"Trần Thị B","email":"b.tran@hcmut.edu.vn","roleInCourse":"owner","cohortId":null,"cohortName":null,"assignedAt":"2026-09-20T02:00:00Z"}
    ],
    "createdAt": "2026-09-20T02:00:00Z",
    "updatedAt": "2026-09-24T09:30:00Z"
  },
  "message": "Thành công"
}
```

> **Thay thế (E3, 2026-10-03):** ví dụ cũ trả `name`, `teacher`, và **nhúng `sections`** (kèm
> `lessons[].type`/`durationSeconds`/`progressState`). Nay:
> - **Không** nhúng `sections`, cũng **không** trả `progressState`/`myProgress` — FE gọi thêm
>   `GET /api/courses/:courseId/sections` và `GET /api/courses/:courseId/lessons` (chi tiết bài học có
>   `GET /api/lessons/:id`). **Lý do:** nhúng `sections` buộc `CourseModule` phải phụ thuộc
>   `LessonModule`, mà `LessonModule` đã phụ thuộc `CourseModule` (`CourseAccessService`) — sẽ thành
>   **phụ thuộc vòng** giữa hai module Nest.
> - `eligibility` là `null` với `teacher`/`admin` (họ không "đăng ký" khoá học nên cờ đủ điều kiện vô
>   nghĩa, và tính nó tốn thêm hai truy vấn cho mọi lần mở trang soạn bài). Với `student` thì **luôn**
>   có giá trị, kể cả khi `eligible: true`.
> - `reason` khi thiếu tiên quyết là câu tiếng Việt do backend sinh, ví dụ:
>   `"Bạn cần hoàn thành khoá học tiên quyết trước: CS100 — Nhập môn tin học."`

**Lỗi thường gặp:** `404` `"Không tìm thấy khoá học với ID <uuid>"`, `403` (học viên xem khoá `draft`/`private`; giảng viên không phụ trách).

#### `PATCH /api/courses/:id`
Cập nhật khoá học.

- **Quyền:** `teacher` **được phân công** (chủ sở hữu hoặc có dòng `course_instructors`), `admin`.
  Riêng đổi `ownerId` là thao tác quản trị: `teacher` gửi trường này → `403 "Bạn không phụ trách khoá học này."`
  (khác `POST`, nơi `ownerId` của `teacher` chỉ bị **bỏ qua**).

```json
{"title":"Nhập môn lập trình (C++)","summary":"Bản cập nhật","visibility":"unlisted","enrollmentOpen":false}
```

Mọi trường của `POST /api/courses` đều nhận ở đây và đều **tuỳ chọn**; service chỉ ghi khoá nào client
thực sự gửi (`undefined` = không đổi). **Không có `status`** — đổi vòng đời chỉ qua
`publish`/`unpublish` để hai đường đó kiểm tra được điều kiện "phải có bài học" và giữ `published_at`
nhất quán. Slug **chỉ** được sinh lại khi client đổi `title` mà không gửi `slug` (đổi slug mỗi lần
sửa mô tả sẽ phá các liên kết đã chia sẻ).

Khi `ownerId` **thực sự đổi**, backend giữ `courses.owner_id` và dòng `owner` trong
`course_instructors` **đồng bộ trong cùng transaction**: nâng vai trò của dòng sẵn có của chủ mới
thành `owner` (thay vì chèn dòng thứ hai — sẽ vi phạm index duy nhất `(course_id, user_id,
COALESCE(cohort_id, …))`), dọn các dòng trùng của chính người đó, rồi xoá dòng `owner` cũ.

**200 OK** — `CourseDetail` sau cập nhật.

**Lỗi thường gặp:** `404`, `403` `"Bạn không phụ trách khoá học này."`, `409` `"Mã khoá học này đã được sử dụng."`, `400` (`ownerId` không phải `teacher`).

#### `DELETE /api/courses/:id`
Xoá khoá học (xoá **mềm**; chặn nếu đã có ghi danh).

- **Quyền:** `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "success": true }, "message": "Đã xoá khoá học" }`

**Lỗi thường gặp:** `409` `"Không thể xoá khoá học đã có học viên ghi danh."`, `404`, `403`.

> Chặn khi có ghi danh vì xoá mềm sẽ làm mọi `enrollments`/`lesson_progress` trỏ tới một khoá không
> còn đọc được — dữ liệu học tập (E5/E8) mất ngữ cảnh. Chỉ muốn ẩn khỏi catalog thì dùng `unpublish`.

#### `PATCH /api/courses/:id/publish`
Công bố khoá học (chuyển `status` → `published`).

- **Quyền:** `teacher` (assigned), `admin`

```json
{"publishLessons":true}
```

`publishLessons` mặc định **`false`**: công bố khoá học **không** tự công bố bài học (một khoá có thể
đang được công bố dần theo từng chương). Khi `true`, backend đặt `is_published = true` cho mọi chương
và bài học chưa công bố của khoá, với `published_at = COALESCE(published_at, now())` — bài/chương đã
công bố từ trước **giữ nguyên** mốc thời gian gốc.

**200 OK** — `{ "error": false, "data": { "id": "...", "status": "published", "updatedAt": "..." }, "message": "Đã công bố khoá học" }`

**Lỗi thường gặp:** `400` `"Khoá học phải có ít nhất một bài học trước khi công bố."` (đếm bài **chưa** xoá mềm), `404`, `403`.

#### `PATCH /api/courses/:id/unpublish`
Chuyển khoá học về `draft` (ẩn khỏi catalog, **giữ nguyên ghi danh**).

- **Quyền:** `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "id": "...", "status": "draft", "updatedAt": "..." }, "message": "Đã ẩn khoá học" }`

**Lỗi thường gặp:** `404`, `403`.

> **E3-T1 DoD:** `unpublish` đặt `status = 'draft'` nhưng **giữ** `published_at` — cột đó ghi *lần đầu
> được công bố*, là dữ liệu cho phân tích (khoá bị ẩn rồi công bố lại vẫn là khoá đã từng lên sóng);
> xoá mốc này là mất thông tin không lấy lại được. Các dòng `enrollments` **không bị đụng tới**: ẩn
> khoá chỉ làm nó biến mất khỏi catalog học viên, tiến độ học tập vẫn nguyên vẹn.

#### `GET /api/courses/:id/instructors`
Danh sách giảng viên được phân công của khoá học (kèm phạm vi lớp nếu có).

- **Quyền:** như `GET /api/courses/:id` (`assertCanView`)

**200 OK** — `{ "error": false, "data": { "items": [ ... ] }, "message": "Thành công" }` với mỗi phần tử
là `CourseInstructorItem`: `{ id, userId, fullName, email, roleInCourse, cohortId, cohortName, assignedAt }`.
`roleInCourse` ∈ `owner` | `co_instructor` | `assistant`; `cohortId: null` = phụ trách cả khoá.

> **Không** phải danh sách phân trang: `data` **chỉ** có `items`, **không** có `meta` (khác quy ước
> §3.4). Cùng hình dạng với `GET /api/courses/:id/cohorts` và `PUT /api/courses/:id/prerequisites`.

**Lỗi thường gặp:** `404`, `403`.

#### `POST /api/courses/:id/instructors`
Phân công đồng giảng viên/trợ giảng cho khoá học (hoặc cho một lớp của khoá).

- **Quyền:** `teacher` (assigned), `admin`

```json
{"userId":"1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d","roleInCourse":"co_instructor","cohortId":null}
```

| Field | Bắt buộc | Ràng buộc |
|---|---|---|
| `userId` | ✔ | UUID v4 của người dùng vai trò `teacher` |
| `roleInCourse` | ✖ | `owner`\|`co_instructor` (mặc định)\|`assistant` |
| `cohortId` | ✖ | UUID v4 của lớp **thuộc đúng khoá này**, hoặc `null` = phụ trách cả khoá |

**201 Created** — trả `CourseInstructorItem` của dòng vừa tạo.

**Lỗi thường gặp:** `400` `"Người dùng này không phải giảng viên."`, `409` `"Giảng viên này đã được phân công cho khoá học."` (trùng theo `(course_id, user_id, cohort_id)`), `404` `"Không tìm thấy lớp với ID <uuid>"`, `403`.

#### `DELETE /api/courses/:id/instructors/:userId`
Gỡ phân công giảng viên khỏi khoá học.

- **Quyền:** `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "success": true }, "message": "Đã gỡ phân công giảng viên" }`

**Lỗi thường gặp:** `400` `"Đây là giảng viên phụ trách chính, không thể gỡ phân công."` (gỡ chủ sở
hữu là **không thể** — `courses.owner_id` vẫn là nguồn chân lý cho quyền quản lý; muốn đổi thì
`PATCH /api/courses/:id` với `ownerId`, chỉ `admin`), `404` `"Người dùng này không phải giảng viên."`, `403`.

#### `GET /api/courses/:id/cohorts`
Danh sách lớp của khoá học kèm sĩ số.

- **Quyền:** như `GET /api/courses/:id` (`assertCanView`)

**200 OK** — `{ "error": false, "data": { "items": [ ... ] }, "message": "Thành công" }`, mỗi phần tử là
`CohortItem`: `{ id, courseId, groupCode, classCode, name, semester, startsOn, endsOn, memberCount, createdAt, updatedAt }`.
`memberCount` là số dòng `enrollments` đang gắn vào lớp; sắp theo `classCode ASC NULLS LAST`, rồi `createdAt`, rồi `id`.

> **Không** có `meta` (không phân trang). `startsOn`/`endsOn` là chuỗi `YYYY-MM-DD` hoặc `null`.

**Lỗi thường gặp:** `404`, `403`.

#### `POST /api/courses/:id/cohorts`
Tạo lớp cho khoá học.

- **Quyền:** `teacher` (assigned), `admin`

```json
{"name":"Lớp K67-CS1","classCode":"L01","groupCode":"CQ_HK261","semester":"1/2026-2027","startsOn":"2026-09-01","endsOn":"2027-01-15"}
```

| Field | Bắt buộc | Ràng buộc |
|---|---|---|
| `name` | ✔ | 1–150 ký tự |
| `classCode` | ✖ | ≤ 50 ký tự, **duy nhất trong khoá** |
| `groupCode` | ✖ | ≤ 50 ký tự |
| `semester` | ✖ | ≤ 20 ký tự |
| `startsOn`, `endsOn` | ✖ | chuỗi ISO `YYYY-MM-DD`; service trả `400` nếu `endsOn < startsOn` |

**201 Created** — trả `CohortItem` (`memberCount: 0`).

**Lỗi thường gặp:** `409` `"Mã lớp này đã tồn tại trong khoá học."`, `400` `"Ngày kết thúc phải sau hoặc bằng ngày bắt đầu."`, `404`, `403`.

#### `PATCH /api/cohorts/:id`
Cập nhật lớp của khoá học mình phụ trách.

- **Quyền:** `teacher` (assigned), `admin` — quyền xét qua **khoá học chứa lớp**, không qua `id` của lớp.

**200 OK** — `CohortItem` sau cập nhật (kèm `memberCount`).

**Lỗi thường gặp:** `404` `"Không tìm thấy lớp với ID <uuid>"`, `409` (trùng `classCode` trong khoá), `400` (`endsOn < startsOn` — kiểm tra trên giá trị **đã ghép** giữa bản ghi hiện có và phần client gửi), `403`.

> `courseId` **không** nằm trong body: chuyển lớp sang khoá khác sẽ làm mọi ghi danh và phân công đang
> trỏ tới lớp đó mang nghĩa khác — muốn đổi thì tạo lớp mới rồi chuyển học viên.

#### `DELETE /api/cohorts/:id`
Xoá lớp (giữ nguyên ghi danh và phân công giảng viên).

- **Quyền:** `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "success": true }, "message": "Đã xoá lớp" }`

**Lỗi thường gặp:** `404`, `403`.

> Xoá cứng nhưng **an toàn**: FK `course_instructors.cohort_id` và `enrollments.cohort_id` đều là
> `ON DELETE SET NULL`, nên học viên vẫn giữ ghi danh và giảng viên vẫn giữ phân công — cả hai chỉ
> thu hẹp phạm vi về "cả khoá".

> **Vì sao lớp có đường dẫn riêng `/api/cohorts/:id`** (tách khỏi `/api/courses/:id/cohorts`): lớp có
> định danh riêng, FE sửa một lớp sau khi đã có `id` của nó — lồng thêm `courseId` vào URL sẽ buộc
> client gọi hai API chỉ để lấy một `id`.

#### `PUT /api/courses/:id/prerequisites`
Thay **toàn bộ** danh sách khoá học tiên quyết của khoá học.

- **Quyền:** `teacher` (assigned), `admin`

```json
{"courseIds":["c9d0e1f2-a3b4-4c5d-8e6f-7a8b9c0d1e2f"]}
```

Là `PUT` (thay thế) chứ không phải `POST` (thêm): FE gửi một mảng là trạng thái cuối cùng xác định, nên
không có chuyện nửa vời khi người dùng bỏ chọn một khoá trong form. Mảng rỗng `[]` hợp lệ = **xoá hết**
tiên quyết. Service tự loại **id trùng nhau** trong mảng; còn `id` của **chính khoá học** là `400`
(`Khoá học không thể là điều kiện tiên quyết của chính nó.`) — **không** bỏ qua im lặng, vì khi đó
`PUT` trả `200` kèm danh sách rỗng và người gọi tưởng đã đặt được tiên quyết (lỗi phát hiện ở kiểm thử
đầu-cuối E3; DB vẫn có `chk_course_prerequisites_not_self` làm chốt chặn cuối).

**200 OK** — `{ "error": false, "data": { "items": [ ... ] }, "message": "Cập nhật điều kiện tiên quyết thành công" }`,
mỗi phần tử là `PrerequisiteCourseRef`: `{ id, code, title, isSatisfied }` (`isSatisfied` là `false` vì
lần trả này không xét theo người gọi).

**Lỗi thường gặp:** `400` `"Không tìm thấy khoá học tiên quyết với ID <uuid>"`, `404`, `403`.

### LessonModule — chương, bài học, học liệu (`/api/courses/:courseId/sections`, `/api/sections`, `/api/lessons`, `/api/materials`)

> **E3 (2026-10-03):** đọc **khối 5 quyết định ở đầu §7 CourseModule** trước — nó áp cho cả mục này.
> Tóm tắt phần liên quan trực tiếp: bài học có `content` + `contentFormat` (không có
> `type`/`videoUrl`/`durationSeconds`); loại bài học là `derivedType` **suy diễn** từ
> `lesson_materials`; mọi route ở đây **yêu cầu đăng nhập** (không `@Public()`).

#### `GET /api/courses/:courseId/sections`
Danh sách chương của khoá học kèm số bài học.

- **Quyền:** đã đăng nhập; qua `CourseAccessService.assertCanView` — `student` chỉ với khoá `published`
  và không `private`; `teacher` phải được phân công; `admin` luôn.
- **Query:** `page`, `take`, `search` (khớp `title`), `order`. **Không** có `sortBy`: endpoint luôn sắp
  `orderIndex ASC` (khoá phụ `id ASC`). Lưu ý mặc định `take` của **riêng** endpoint này là **100**
  (không phải 20): một khoá học thường có ít chương và FE cần đủ chương để dựng lộ trình trong một lần
  gọi. Trần vẫn là `MAX_TAKE = 100`.

**200 OK**

```json
{
  "error": false,
  "data": {"items":[{"id":"e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","title":"Chương 1 — Giới thiệu","description":null,"orderIndex":1,"isPublished":true,"publishedAt":"2026-09-20T02:10:00Z","lessonCount":4}],"meta":{"page":1,"take":100,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

> **Sửa ở E3 (2026-10-03):** bản cũ ghi "không phân trang — số chương nhỏ" và ví dụ có
> `createdAt`/`updatedAt`. Thực tế endpoint **có** phân trang (`page`/`take`, mặc định `take = 100`),
> và `SectionListItem` **không** trả `createdAt`/`updatedAt` mà trả `publishedAt` (xem ghi chú
> *Cần xác nhận* ở §3.3). `lessonCount` là số bài **chưa xoá mềm** trong chương, nạp bằng **một** truy
> vấn gộp cho cả trang (không N+1).

**Lỗi thường gặp:** `404` `"Không tìm thấy khoá học với ID <uuid>"`, `403`, `400` (`courseId` không phải UUID v4 — chặn ở tầng pipe để không rơi xuống Postgres và trả `500`).

#### `POST /api/courses/:courseId/sections`
Tạo chương mới trong khoá học.

- **Quyền:** `teacher` (assigned), `admin`

```json
{"title":"Chương 2 — Biến và kiểu dữ liệu","description":"Nội dung chương 2","isPublished":false}
```

**201 Created** — trả `SectionListItem`; `orderIndex` tự động = `MAX(order_index) + 1` trong khoá (dùng
`MAX` chứ không `COUNT` để không sinh trùng sau khi một chương bị xoá), `publishedAt` = `now()` nếu
`isPublished = true`, ngược lại `null`.

**Lỗi thường gặp:** `404`, `403`, `400` (`title` rỗng, `title` > 255, `description` > 2000).

#### `GET /api/sections/:id`
Chi tiết chương kèm danh sách bài học.

- **Quyền:** đã đăng nhập; quyền xét theo **khoá học chứa chương** (`assertCanView`). Nếu người gọi
  **không** được sửa nội dung (học viên), danh sách bài bị lọc `is_published = true`.

**200 OK** — `SectionDetail` = `SectionListItem` + `lessons: LessonListItem[]`. Mỗi phần tử `lessons`
theo đúng hình dạng ở `GET /api/courses/:courseId/lessons` (`derivedType`, `materialCount`…), **không**
có `type`/`durationSeconds`. Danh sách này bị chặn trần **100** bài (`SECTION_DEFAULT_TAKE`); chương
nào nhiều hơn thì dùng `GET /api/courses/:courseId/lessons?sectionId=...` để lấy đủ.

**Lỗi thường gặp:** `404` `"Không tìm thấy chương với ID <uuid>"`, `403`.

#### `PATCH /api/sections/:id`
Cập nhật chương.

- **Quyền:** `teacher` (assigned), `admin`

```json
{"title":"Chương 2 — Kiểu dữ liệu và toán tử","isPublished":true}
```

**200 OK** — `SectionListItem` sau cập nhật.

> Quy tắc `publishedAt` (nằm ở **service**, không ở DTO): bật `isPublished` chỉ đặt `publishedAt` nếu
> chương **chưa từng** công bố (đối xứng với `publish`/`hide` của bài học); tắt thì xoá về `null`.

**Lỗi thường gặp:** `404`, `403`, `400`.

#### `DELETE /api/sections/:id`
Xoá chương (cascade xoá bài học bên trong — cần xác nhận ở FE).

- **Quyền:** `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "id": "<uuid>" }, "message": "Đã xoá chương" }`

**Lỗi thường gặp:** `404`, `403`, **`409`**
`"Không thể xoá chương vì đã có bài làm hoặc tiến độ học tập của học viên."`

> **Sửa ở E3 (2026-10-03):** bản cũ trả `data: { success: true }` và không có `409`. Thực tế trả
> `{ id }` và **chặn khi còn dấu vết học tập** (E3-T2 DoD "bảo vệ dữ liệu phân tích"): xoá chương sẽ
> `ON DELETE CASCADE` xoá luôn bài học, học liệu, quiz và — qua cascade của `lesson_progress`/
> `submissions` — toàn bộ tiến độ của học viên. Chương **không** có xoá mềm và các chương còn lại
> **không** cần đánh số lại (chương không phải "bài kế tiếp" của lộ trình).

#### `PATCH /api/courses/:courseId/sections/reorder`
Sắp xếp lại thứ tự chương trong khoá học (gửi **danh sách đầy đủ** để tránh trạng thái nửa vời).

- **Quyền:** `teacher` (assigned), `admin`

```json
{"items":[{"id":"e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081","orderIndex":2},{"id":"a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d","orderIndex":1}]}
```

**200 OK** — `{ "error": false, "data": { "updated": 2 }, "message": "Đã cập nhật thứ tự chương" }`

**Lỗi thường gặp:** `400`, `404` (id không thuộc khoá học), `403`.

> **Thân yêu cầu phải bao gồm ĐÚNG VÀ ĐỦ chương hiện có** của khoá; `orderIndex` phải là dãy **liên
> tục từ 1**. Thiếu / thừa / trùng id hoặc trùng thứ tự → `400` với thông điệp cụ thể:
> `"Danh sách sắp xếp không hợp lệ: các mục phải khớp đúng và đủ tập bản ghi hiện có."`,
> `"Danh sách sắp xếp không được có ID trùng nhau."`,
> `"Danh sách sắp xếp không được có thứ tự trùng nhau."`,
> `"Danh sách sắp xếp phải bao gồm mọi bản ghi hiện có, không được thiếu mục nào."`,
> `"Danh sách sắp xếp chứa bản ghi không thuộc phạm vi cho phép."`,
> `"Thứ tự sắp xếp phải là dãy liên tục bắt đầu từ 1 (1, 2, 3, …)."`.
> Toàn bộ thao tác nằm trong **một transaction** và đi **hai pha** (đẩy hết về giá trị âm rồi ghi giá
> trị cuối) vì `UNIQUE (course_id, order_index)` sẽ bị vi phạm **tạm thời** khi đổi chỗ hai chương.

> **Lưu ý routing:** `PATCH /api/courses/:courseId/sections/reorder` **không** xung đột với
> `PATCH /api/sections/:id` vì khác hẳn đoạn đường dẫn — không có nguy cơ `reorder` bị khớp thành UUID.
> Nest khớp theo **đoạn đường dẫn đầy đủ** chứ không theo thứ tự khai báo. (Ghi chú này giữ lại vì
> `UserController` có bẫy tương tự với `me` và `:id`, nơi thứ tự khai báo *mới* quan trọng.)

#### `GET /api/courses/:courseId/lessons`
Danh sách bài học của khoá học (phẳng, có lọc) — tiện cho dashboard/analytics và cho FE dựng mục lục.

- **Quyền:** đã đăng nhập; qua `assertCanView` (khoá `published` + không `private`, hoặc người phụ
  trách/admin). Với `student`, backend **ép** `is_published = true` ở tầng SQL bất kể query gửi gì
  (nếu tin tham số client thì chỉ cần `?isPublished=false` là đọc được bài đang soạn). Bài đã xoá mềm
  luôn bị loại.
- **Query:** `page`, `take` (trần **100**), `search` (khớp `title`), `sectionId` (UUID v4), `isPublished`
  (`true`\|`false`, chỉ có tác dụng với `teacher`/`admin`), `sortBy` (`orderIndex`\|`createdAt`\|`title`,
  mặc định `orderIndex`), `order` (mặc định **`asc`** — danh sách bài học là **lộ trình**, đọc từ bài 1
  tới bài cuối; nếu để mặc định `desc` của `PaginationQueryDto` thì lộ trình bị đảo ngược và nút "bài
  kế tiếp" ở FE hỏng âm thầm).

**200 OK**

```json
{
  "error": false,
  "data": {"items":[{"id":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","sectionId":"e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","title":"Bài 1 — Tổng quan môn học","slug":"bai-1-tong-quan-mon-hoc","summary":null,"orderIndex":1,"estimatedMinutes":45,"isPublished":true,"publishedAt":"2026-09-20T02:20:00Z","dueAt":null,"availableFrom":null,"derivedType":"video","materialCount":2}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

> **Thay thế (E3, 2026-10-03):** ví dụ cũ trả `type` và `durationSeconds`, và bảng query cũ có tham số
> lọc `type` và `search` khớp `title`. Nay: tham số lọc `type` **không tồn tại** (loại bài học là
> `derivedType` **suy diễn**, không phải cột nên không lọc được ở SQL); `durationSeconds` cũng không
> có trên bài học — nó là trường của **học liệu** (`lesson_materials.duration_seconds`). Thêm
> `derivedType` và `materialCount` (cả hai nạp bằng **một** truy vấn gộp cho cả trang).
> `LessonListItem` **không** trả `createdAt`/`updatedAt` (xem *Cần xác nhận* ở §3.3).

**Lỗi thường gặp:** `404`, `403` (học viên với khoá chưa publish/`private`), `400` (`take > 100`, `sortBy` ngoài whitelist).

#### `POST /api/sections/:sectionId/lessons`
Tạo bài học mới trong chương.

- **Quyền:** `teacher` (assigned), `admin`

```json
{"title":"Bài 2 — Biến và hằng số","summary":"Tóm tắt ngắn","content":"<p>Nội dung bài học dạng HTML (TipTap)...</p>","contentFormat":"html","estimatedMinutes":45,"availableFrom":"2026-10-01T00:00:00Z","dueAt":"2026-10-15T17:00:00Z","isPublished":false}
```

| Field | Bắt buộc | Ràng buộc |
|---|---|---|
| `title` | ✔ | 3–255 ký tự |
| `summary` | ✖ | ≤ 500 ký tự |
| `content` | ✖ | nội dung bài học (text lớn) |
| `contentFormat` | ✖ | `markdown`\|`html` (**mặc định**, vì editor của FE là TipTap)\|`tiptap_json` |
| `estimatedMinutes` | ✖ | số nguyên ≥ 0 |
| `availableFrom`, `dueAt` | ✖ | chuỗi ISO 8601 (`date-time`) |
| `isPublished` | ✖ | boolean, mặc định `false`; `true` ⇒ đặt `publishedAt = now()` |

> **Thay thế (E3, 2026-10-03) — bảng cũ:** `type` (bắt buộc), `videoUrl`, `durationSeconds`. Cả ba
> **không tồn tại** trên `lessons`; video/slide/tệp đi qua `POST /api/lessons/:id/materials` (xem dưới).
> `slug` **không** nhận từ client (sinh từ `title`, duy nhất trong khoá) và `orderIndex` **cũng không**
> — nó là **toàn khoá học**, không phải trong chương, vì `uq_lessons_course_order` ràng buộc theo
> `course_id` (đánh số từ 1 trong mỗi chương sẽ vi phạm khoá duy nhất ngay bài đầu của chương thứ hai).

> **An toàn nội dung HTML (stored-XSS) — chốt ở E3 (2026-10-03):** backend **lưu nguyên văn** HTML mà
> editor gửi lên (`content`, `contentFormat = 'html'`); **không** sanitize ở server. Chốt chặn nằm ở
> **FE, lúc render**: `frontend/src/utils/html.ts` (`sanitizeHtml`, dùng **DOMPurify** với allowlist
> thẻ/thuộc tính của TipTap, chặn sẵn `javascript:`/`data:` trong `href`/`src` và thêm `rel="noopener"`
> cho `target="_blank"`), được gọi **trước** `dangerouslySetInnerHTML` ở trang xem bài học. Hệ quả cần
> nhớ: mọi nơi render `lesson.content` (kể cả preview trong trình soạn, email/thông báo sau này) đều
> **bắt buộc** đi qua `sanitizeHtml`; API không bảo vệ ai gọi nó ngoài FE.

**201 Created** — trả `LessonDetail` (kèm `content`, `contentFormat`, `section`, `materials`).

**Lỗi thường gặp:** `404` `"Không tìm thấy chương với ID <uuid>"`, `403`, `400`.

#### `GET /api/lessons/:id`
Chi tiết bài học (kèm học liệu).

- **Quyền — quy tắc hiển thị này là DoD được chấm điểm (E3-T2):**

| Vai trò | Điều kiện | Không đủ điều kiện |
|---|---|---|
| `admin` | **luôn** xem được (kể cả bài chưa công bố của khoá `draft`) — cần cho kiểm duyệt | — |
| `teacher` | phải **được phân công** khoá học (`courses.owner_id` hoặc có dòng `course_instructors`) | `403` |
| `student` | cần **đủ ba**: (a) khoá `status = 'published'` và `visibility <> 'private'`; (b) bài `is_published = true` và **chưa** xoá mềm; (c) có dòng `enrollments` với `status IN ('active','completed')` | `403` |

  Thiếu bất kỳ điều kiện nào của `student` là `403` (không phải `404`) — theo ma trận §6 và để FE phân
  biệt "không có quyền" với "gõ sai ID". Thông điệp: `"Bạn không có quyền truy cập bài học này."`
  Lưu ý: `teacher` **không** dùng cửa `assertCanView` ở đây, vì cửa đó cho qua mọi khoá `published` —
  giảng viên không phụ trách sẽ đọc được bài của đồng nghiệp.

**200 OK**

```json
{
  "error": false,
  "data": {
    "id": "f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192",
    "sectionId": "e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081",
    "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
    "title": "Bài 1 — Tổng quan môn học",
    "slug": "bai-1-tong-quan-mon-hoc",
    "summary": null,
    "orderIndex": 1,
    "estimatedMinutes": 45,
    "isPublished": true,
    "publishedAt": "2026-09-20T02:20:00Z",
    "dueAt": null,
    "availableFrom": null,
    "derivedType": "video",
    "materialCount": 1,
    "content": "<p>Nội dung bài học dạng HTML (TipTap)...</p>",
    "contentFormat": "html",
    "section": {"id":"e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081","title":"Chương 1 — Giới thiệu","orderIndex":1},
    "materials": [
      {"id":"0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d","lessonId":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","title":"Slide bài 1","materialType":"slide","url":"http://localhost:3000/uploads/lessons/f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192/9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f.pdf","content":null,"mimeType":"application/pdf","fileSizeBytes":2456789,"durationSeconds":null,"orderIndex":1,"isPublished":true,"createdAt":"2026-09-20T02:25:00Z","updatedAt":"2026-09-20T02:25:00Z"}
    ]
  },
  "message": "Thành công"
}
```

> **Thay thế (E3, 2026-10-03):** ví dụ cũ trả `type`, `videoUrl`, `durationSeconds` và
> `myProgress`/`materials.kind`/`materials.fileUrl`. Nay:
> - **không** `type`/`videoUrl`/`durationSeconds` trên bài học; thay bằng `derivedType` (suy diễn) và
>   `content` + `contentFormat`;
> - `materials[]` là **mảng** (bản cũ để một object đơn), dùng `materialType`/`url` (không phải
>   `kind`/`fileUrl`) và có thêm `orderIndex`/`isPublished`/`content`;
> - **không** trả `myProgress`: tiến độ theo bài học thuộc `LessonProgress`/`EnrollmentModule` (E4) —
>   bài học ở E3 chưa đọc trạng thái tiến độ của người gọi;
> - **không** trả `createdAt`/`updatedAt` của bài học (xem *Cần xác nhận* ở §3.3); học liệu thì **có**
>   cả hai;
> - `derivedType`: `video` nếu bài có ít nhất một học liệu `materialType = 'video'`, ngược lại `slide`,
>   ngược lại `file`, ngược lại `text`; học liệu `link` **không** nâng loại (bài chỉ có `link` vẫn là
>   `text`). Đây là giá trị **suy diễn**, FE **không** được ghi ngược xuống server.

**Lỗi thường gặp:** `404` `"Không tìm thấy bài học với ID <uuid>"`, `403` `"Bạn không có quyền truy cập bài học này."`.

#### `PATCH /api/lessons/:id`
Cập nhật bài học.

- **Quyền:** `teacher` (assigned), `admin`

```json
{"title":"Bài 1 — Tổng quan và cách học hiệu quả","estimatedMinutes":60,"contentFormat":"html","isPublished":true}
```

Mọi trường của `POST /api/sections/:sectionId/lessons` đều nhận ở đây và đều tuỳ chọn, cộng thêm
`sectionId` để **di chuyển bài sang chương khác trong cùng khoá học**.

**200 OK** — `LessonDetail` sau cập nhật.

**Lỗi thường gặp:** `404`, `403`,
`400` `"Chỉ có thể chuyển bài học sang chương khác trong cùng khoá học."` (chuyển sang khoá khác sẽ
kéo theo quiz, tiến độ và ghi danh — ngoài phạm vi E3-T2).

> `slug` **không** có trong DTO: nó sinh từ `title`. Muốn giữ slug cũ thì đừng gửi `title`; gửi `title`
> khác thì slug được sinh lại (duy nhất trong khoá).

#### `DELETE /api/lessons/:id`
Xoá bài học (**xoá mềm** + đánh số lại lộ trình).

- **Quyền:** `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "id": "<uuid>" }, "message": "Đã xoá bài học" }`

**Lỗi thường gặp:** `404`, `403`, **`409`**
`"Không thể xoá bài học vì đã có bài làm hoặc tiến độ học tập của học viên."`

> **Sửa ở E3 (2026-10-03):** bản cũ trả `data: { success: true }` và để `409` ở dạng "tuỳ chọn/đề
> xuất". Thực tế: trả `{ id }`, `409` là **bắt buộc** (E3-T2 DoD "bảo vệ dữ liệu phân tích"), và thao
> tác này **đánh số lại** các bài còn lại của **toàn khoá** thành dãy liên tục trong cùng một
> transaction (đẩy tạm về giá trị âm rồi ghi lại, vì `order_index` có UNIQUE partial) — để "bài kế
> tiếp" ở FE không nhảy cóc. Bài bị xoá mềm cũng được đặt `is_published = false` và `published_at = null`.

#### `PATCH /api/sections/:sectionId/lessons/reorder`
Sắp xếp lại thứ tự bài học trong một chương.

- **Quyền:** `teacher` (assigned), `admin`

```json
{"items":[{"id":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","orderIndex":2}]}
```

**200 OK** — `{ "error": false, "data": { "updated": 1 }, "message": "Đã cập nhật thứ tự bài học" }`

**Lỗi thường gặp:** `400` (cùng bộ thông điệp như `reorder` chương: thiếu/thừa/trùng id, trùng thứ tự,
`orderIndex` không liên tục từ 1), `404` (bài học không thuộc chương), `403`.

> **E3-T2:** `items` phải bao gồm **đúng và đủ** bài **chưa xoá** của chương đó. Vì
> `uq_lessons_course_order` là UNIQUE theo `course_id`, thứ tự phải liên tục trên **toàn khoá học**:
> service lấy đúng các **vị trí** mà các bài của chương đang chiếm trong khoá (giữ nguyên vị trí của
> bài thuộc chương khác) rồi xếp lại theo yêu cầu — nhờ đó thao tác trên một chương không xáo trộn lộ
> trình của các chương còn lại.

#### `PATCH /api/lessons/:id/publish`
Công bố bài học cho học viên.

- **Quyền:** `teacher` (assigned), `admin`
- **Body:** không có.

**200 OK** — `{ "error": false, "data": { "id": "...", "isPublished": true, "updatedAt": "..." }, "message": "Đã công bố bài học" }`

**Lỗi thường gặp:** `404`, `403`.

> Hai endpoint `publish`/`hide` cố ý **không** trả `LessonDetail`: chúng chỉ là thao tác bật/tắt cờ, FE
> chỉ cần trạng thái mới và mốc cập nhật (để vô hiệu hoá cache) — trả cả chi tiết bài học sẽ kéo theo
> truy vấn học liệu không cần thiết cho một cú click. `publishedAt` chỉ được đặt nếu bài **chưa từng**
> công bố (`published_at = COALESCE`-kiểu), nên bật lại bài cũ không ghi đè mốc gốc.

#### `PATCH /api/lessons/:id/hide`
Ẩn bài học (học viên đã học vẫn giữ tiến độ, nhưng không truy cập được nữa).

- **Quyền:** `teacher` (assigned), `admin`
- **Body:** không có.

**200 OK** — `{ "error": false, "data": { "id": "...", "isPublished": false, "updatedAt": "..." }, "message": "Đã ẩn bài học" }`

**Lỗi thường gặp:** `404`, `403`.

> `hide` đặt `is_published = false` **và** `published_at = null` (đối xứng: lần bật sau sẽ ghi mốc
> mới). Bản ghi tiến độ của học viên **không** bị đụng tới.

#### `POST /api/lessons/:id/materials`
Tải học liệu lên bài học (slide, PDF, video, tài liệu đính kèm) — **`multipart/form-data`**.

- **Quyền:** `teacher` (assigned), `admin`
- **Trường form:** `file` (**bắt buộc**, nhị phân) + `title` (tuỳ chọn, ≤ 255 ký tự; bỏ trống thì lấy
  tên tệp gốc làm tiêu đề **hiển thị**). Tệp được lấy bằng `FileInterceptor('file')` trong **bộ nhớ**
  (`file.buffer`), **không** qua DTO — xem cảnh báo bên dưới.
- **Giới hạn:** tối đa `MAX_UPLOAD_SIZE_MB` MB/tệp (**mặc định 50**), đọc từ `.env`; vượt → `413`.
  MIME ngoài whitelist → `415`. **`materialType` được suy ra từ MIME**, client **không** gửi trường này.

| MIME | Đuôi ghi lên đĩa | `materialType` |
|---|---|---|
| `application/pdf` | `.pdf` | `slide` |
| `application/vnd.ms-powerpoint` | `.ppt` | `slide` |
| `application/vnd.openxmlformats-officedocument.presentationml.presentation` | `.pptx` | `slide` |
| `application/msword` | `.doc` | `file` |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | `file` |
| `application/zip` | `.zip` | `file` |
| `video/mp4` | `.mp4` | `video` |
| `image/png` | `.png` | `file` |
| `image/jpeg` | `.jpg` | `file` |

```http
POST /api/lessons/f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192/materials HTTP/1.1
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data; boundary=----Y

------Y
Content-Disposition: form-data; name="file"; filename="slide-bai-1.pdf"
Content-Type: application/pdf

<binary>
------Y
Content-Disposition: form-data; name="title"

Slide bài 1
------Y--
```

**201 Created**

```json
{
  "error": false,
  "data": {"id":"0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d","lessonId":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","title":"Slide bài 1","materialType":"slide","url":"http://localhost:3000/uploads/lessons/f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192/9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f.pdf","content":null,"mimeType":"application/pdf","fileSizeBytes":2456789,"durationSeconds":null,"orderIndex":1,"isPublished":true,"createdAt":"2026-09-20T02:25:00Z","updatedAt":"2026-09-20T02:25:00Z"},
  "message": "Tải học liệu lên thành công"
}
```

> **Thay thế (E3, 2026-10-03):** bản cũ ghi endpoint là **(đề xuất)**, giới hạn "đề xuất", và trả
> `kind`/`fileUrl` với URL `https://cdn.uniprep.local/...`. Nay endpoint **đã chạy**: trường trả về là
> `materialType`/`url`, `content`/`durationSeconds` luôn `null` với tệp tải lên (chúng dành cho học
> liệu `text`/`link`/video nhập tay), `orderIndex` = `MAX + 1` trong bài và `isPublished = true` ngay
> khi tải lên.

**Thứ tự kiểm tra là một phần của hợp đồng:** `400` (không có tệp) → `415` (MIME ngoài whitelist) →
`413` (quá dung lượng) → ghi đĩa → ghi DB. Kiểm MIME **trước** dung lượng để một tệp `.exe` 100 MB nhận
đúng thông báo "định dạng không được hỗ trợ" thay vì "quá lớn".

**Lỗi thường gặp:**
- `400` `"Vui lòng chọn tệp để tải lên."` (thiếu tệp) hoặc `"Tên tệp không hợp lệ."`
- `415` `"Định dạng tệp không được hỗ trợ. Chỉ nhận: PDF, PowerPoint (.ppt), PowerPoint (.pptx), Word (.doc), Word (.docx), ZIP, Video MP4, Ảnh PNG, Ảnh JPEG."`
- `413` `"Tệp vượt quá dung lượng cho phép (tối đa 50 MB)."`
- `404`, `403`

> ⚠️ Với `multipart/form-data`, **không** khai trường `file` trong DTO: `ValidationPipe` toàn cục bật
> `whitelist: true` và với multipart thì `class-transformer` không có metadata để loại trừ nên nó sẽ
> **gỡ luôn `file`** khỏi body — request đúng vẫn trả `400`. Áp dụng cho mọi DTO của endpoint multipart.
>
> **Nơi lưu tệp — đã chốt ở E3 (xem mục 13, câu hỏi 3):** **đĩa cục bộ**, thư mục `UPLOAD_DIR`
> (mặc định `./uploads`), mỗi bài một thư mục con `lessons/<lessonId>/`. Tên tệp trên đĩa do server
> sinh (`randomUUID()` + đuôi tra từ MIME) — tên tệp client gửi **không bao giờ** đi vào đường dẫn.
> Tệp được phục vụ tĩnh tại **`/uploads/**`** (không có tiền tố `/api`), còn `url` trả về là URL
> **tuyệt đối** = `PUBLIC_BASE_URL` (mặc định `http://localhost:3000`) + `/uploads/<storageKey>`.

#### `GET /api/lessons/:id/materials`
Danh sách học liệu của bài học (phân trang; sắp `orderIndex ASC`, rồi `createdAt ASC`).

- **Quyền:** **đúng** quy tắc hiển thị của `GET /api/lessons/:id` (dùng chung một hàm
  `assertLessonViewable` — không chép lại điều kiện, vì đây là chỗ dễ lệch nhất: học liệu thường chứa
  chính nội dung mà bài học đang giấu).
- **Query:** `page`, `take` (trần **100**, mặc định `20`).

**200 OK**

```json
{
  "error": false,
  "data": {"items":[{"id":"0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d","lessonId":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","title":"Slide bài 1","materialType":"slide","url":"http://localhost:3000/uploads/lessons/f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192/9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f.pdf","content":null,"mimeType":"application/pdf","fileSizeBytes":2456789,"durationSeconds":null,"orderIndex":1,"isPublished":true,"createdAt":"2026-09-20T02:25:00Z","updatedAt":"2026-09-20T02:25:00Z"}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

> **Sửa ở E3 (2026-10-03):** bản cũ ghi "không phân trang; sắp theo `createdAt asc`" và trả
> `kind`/`fileUrl`. Thực tế endpoint **có** phân trang (`page`/`take`) và trả `materialType`/`url`.
> Đây là một trong hai collection **không** phân trang theo nghĩa người dùng nhưng vẫn trả `{ items,
> meta }` (cùng với `sections`) — `meta` vẫn theo đúng §3.4, `itemCount` vẫn là **tổng**.

**Lỗi thường gặp:** `404`, `403`.

#### `DELETE /api/materials/:id`
Xoá học liệu (kèm tệp đã tải lên nếu có).

- **Quyền:** `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "id": "<uuid>" }, "message": "Đã xoá học liệu" }`

**Lỗi thường gặp:** `404` `"Không tìm thấy học liệu với ID <uuid>"`, `403`.

> **Sửa ở E3 (2026-10-03):** bản cũ trả `data: { success: true }`. Thực tế trả `{ id }`.
> Xoá theo thứ tự: hàng DB trước, **rồi** xoá tệp trên đĩa theo kiểu **best-effort** — thiếu tệp
> **không** làm request thất bại, vì hàng DB là nguồn chân lý và báo lỗi sau khi hàng đã xoá sẽ để lại
> trạng thái nửa vời cho người dùng.

### EnrollmentModule — ghi danh & tiến độ (`/api/enrollments`, `/api/lessons/:id/complete`)

> Ghi danh/tiến độ có thể nằm trong `CourseModule`; tách thành `EnrollmentModule` là **(đề xuất)** cho dễ bảo trì.
> Trên thực tế `EnrollmentController` nằm trong `CourseModule` (`backend/src/course/enrollment.controller.ts`).

> **E3 — lát cắt tối thiểu đã làm (2026-10-03):** chỉ **`POST /api/enrollments`** được kéo trước từ
> E4-T1 để DoD của E3-T7 ("nút đăng ký gọi API thật và phản ánh trạng thái đã đăng ký") có đường tạo
> dòng `enrollments` — không có nó thì `GET /api/lessons/:id` không thể kiểm chứng quy tắc "học viên
> phải đã ghi danh mới xem được bài".
> **E4 hoàn thành (2026-10-03):** `GET /api/enrollments`, `GET /api/enrollments/:id`,
> `DELETE /api/enrollments/:id`, `GET /api/enrollments/:id/progress`,
> `POST|DELETE /api/lessons/:id/complete` và `GET /api/courses/:id/progress` đã có trong repo.
> Enrollment bị huỷ dùng `status='dropped'`; hoàn thành lặp trả `200` idempotent. Progress chỉ tính
> bài published; `createdLearningEventIds` là mảng rỗng cho đến E7.

#### `POST /api/enrollments`
Ghi danh khoá học cho **chính** người gọi.

- **Quyền:** `@Roles('student','admin')` — `teacher` ghi danh là `403` (theo ma trận §6).
- **Body:** `{ courseId, cohortId? }` — **không** có `userId`: người ghi danh luôn là người đang gọi
  (`@CurrentUser()`); nhận `userId` từ body là mở đường cho IDOR (§6). `cohortId` bỏ trống = không gắn lớp.

```json
{"courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","cohortId":null}
```

**Thứ tự kiểm tra (rẻ → đắt) và mã lỗi:**

| Bước | Không đạt |
|---|---|
| 1. Khoá học tồn tại và **chưa** xoá mềm | `404` `"Không tìm thấy khoá học với ID <uuid>"` |
| 2. Khoá `status = 'published'` và `visibility <> 'private'` | `400` `"Khoá học này không mở đăng ký."` |
| 3. `enrollmentOpen = true` | `400` `"Khoá học này không mở đăng ký."` |
| 4. `cohortId` (nếu gửi) thuộc **đúng khoá** này | `404` `"Không tìm thấy lớp với ID <uuid>"` |
| 5. `maxStudents` chưa đầy (đếm `status <> 'dropped'` — học viên đã huỷ **không** chiếm chỗ) | `400` `"Khoá học đã đủ số lượng học viên."` |
| 6. Chưa có dòng ghi danh — nếu có và `status = 'dropped'` thì **mở lại** dòng đó thành `active`, xoá `droppedAt`, cập nhật `cohortId`; nếu `status` khác `dropped` | `409` `"Bạn đã đăng ký khoá học này."` |
| 7. Điều kiện tiên quyết (`CourseEligibilityService.assertEligible` — kiểm tra **sau cùng** vì đắt nhất) | `400` `"Bạn cần hoàn thành khoá học tiên quyết trước: CS100 — Nhập môn tin học."` |

**201 Created**

```json
{
  "error": false,
  "data": {"id":"d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70","status":"active","progressPercent":0,"enrolledAt":"2026-09-22T04:00:00Z","completedAt":null},
  "message":"Đăng ký khoá học thành công"
}
```

> **Thay thế (E3, 2026-10-03):** bản cũ nhận `userId` trong body, trả thêm `courseId`/`userId`/
> `createdAt`/`updatedAt`, và message là `"Ghi danh thành công"`. Hình dạng thật là
> `MyEnrollmentSummary` = `{ id, status, progressPercent, enrolledAt, completedAt }` (khớp
> `frontend/src/types/enrollment.ts`), message `"Đăng ký khoá học thành công"`.
> `status` mặc định `'active'`, `source = 'self'`, `progressPercent = 0`.
> Ràng buộc `UNIQUE (user_id, course_id)` là chốt chặn cuối cho hai request song song: lỗi Postgres
> `23505` được dịch thành **cùng** `409` ở trên thay vì để lộ `500`.

**Lỗi thường gặp:** `400` (khoá chưa publish/`private`, `enrollmentOpen = false`, đủ sĩ số, thiếu tiên
quyết), `409` `"Bạn đã đăng ký khoá học này."`, `404` (khoá/lớp không tồn tại), `403` (`teacher`).

> `EnrollmentStatus` của DB là `'active' | 'completed' | 'dropped' | 'expired'`; huỷ ghi danh dùng
> `dropped`, không có trạng thái `cancelled`.

#### `GET /api/enrollments`
Danh sách ghi danh: học viên xem khoá của mình; giảng viên xem học viên trong khoá mình phụ trách; admin xem tất cả.

- **Quyền:** `student` (own), `teacher` (assigned), `admin`
- **Query:** `page`, `take`, `courseId`, `userId` (chỉ teacher/admin), `status` (`active,completed,dropped,expired`), `search` (khớp `fullName`, `email`, `studentCode` của học viên), `sortBy` (`enrolledAt`\|`progressPercent`), `order`

```http
GET /api/enrollments?courseId=b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f&status=active&page=1&take=20
```

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": [{"id":"d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","course":{"id":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","code":"CS101","title":"Nhập môn lập trình","summary":"Khoá học mẫu"},"student":{"id":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","fullName":"Nguyễn Văn A","email":"sv2026001@hcmut.edu.vn","studentCode":"SV2026001"},"status":"active","progressPercent":45.5,"completedLessons":14,"totalLessons":32,"resumeLessonId":"a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d","enrolledAt":"2026-09-22T04:00:00Z","lastActivityAt":"2026-09-25T13:10:00Z"}],
    "meta": {"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `403` (học viên gửi `userId` của người khác), `400`.

> `progressPercent` và `completedLessons` chỉ tính bài đang published; `resumeLessonId` là bài
> published đầu tiên chưa hoàn thành, hoặc `null` khi không còn bài nào.

#### `GET /api/enrollments/:id`
Chi tiết một ghi danh.

- **Quyền:** `student` (own), `teacher` (assigned), `admin`

**200 OK** — object ghi danh như trên (kèm `course`, `student`, `progressPercent`).

**Lỗi thường gặp:** `404`, `403` `"Bạn chỉ có thể xem dữ liệu của chính mình."`.

#### `DELETE /api/enrollments/:id`
Huỷ ghi danh (giữ lại dữ liệu học tập để phục vụ thống kê → chuyển `status = 'dropped'`).

- **Quyền:** `student` (own), `admin`

**200 OK** — `{ "error": false, "data": { "id": "...", "status": "dropped", "updatedAt": "..." }, "message": "Đã huỷ ghi danh" }`

**Lỗi thường gặp:** `404`, `403`, `409` (đã huỷ trước đó).

> Huỷ một ghi danh `completed` hoặc `expired` cũng chuyển sang `dropped`; tiến độ được giữ nguyên.

> **Sửa ở E3 (2026-10-03):** bản cũ ghi `status = 'cancelled'`; union thật của DB là `'dropped'`
> (`database-design.md` §7.3) và `POST /api/enrollments` đã hiện thực nhánh mở lại dòng `'dropped'` —
> nên E4 phải dùng `'dropped'`.

#### `GET /api/enrollments/:id/progress`
Tiến độ chi tiết theo từng bài học của một ghi danh — dùng để render trang "nội dung khoá học".

- **Quyền:** `student` (own), `teacher` (assigned), `admin`

**200 OK**

```json
{
  "error": false,
  "data": {
    "enrollmentId": "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70",
    "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
    "progressPercent": 45.5,
    "completedLessons": 14,
    "totalLessons": 32,
    "lastActivityAt": "2026-09-25T13:10:00Z",
    "resumeLessonId": "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d",
    "sections": [{"sectionId":"e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081","title":"Chương 1 — Giới thiệu","completedLessons":1,"totalLessons":2,"lessons":[{"lessonId":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","title":"Bài 1 — Tổng quan môn học","state":"completed","completedAt":"2026-09-23T11:00:00Z","timeSpentSeconds":840},{"lessonId":"a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d","title":"Bài 2 — Biến và hằng số","state":"not_started","completedAt":null,"timeSpentSeconds":0}]}
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `404`, `403`.

> `sections` là mảng và chỉ gồm bài đang published. `attemptCount` sẽ bổ sung khi quiz thuộc E5.

#### `POST /api/lessons/:id/complete`
Đánh dấu hoàn thành một bài học (idempotent — gọi lại không tạo bản ghi trùng).

- **Quyền:** `student` (own, phải đã ghi danh khoá chứa bài học)

```json
{"timeSpentSeconds":840}
```

**200 OK**

```json
{
  "error": false,
  "data": {"lessonId":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","enrollmentId":"d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70","state":"completed","completedAt":"2026-09-23T11:00:00Z","progressPercent":46.9,"createdLearningEventIds":[]},
  "message": "Đã đánh dấu hoàn thành bài học"
}
```

Gọi lại khi bài đã hoàn thành vẫn trả `200` với cùng trạng thái/thời điểm hoàn thành; không tạo dòng
progress trùng và không cộng lại thời gian. `createdLearningEventIds` hiện là `[]`; E7 sẽ nối telemetry.

**Lỗi thường gặp:** `404`, `403` (chưa ghi danh hoặc không được xem bài), `400` (thời gian không hợp lệ).

#### `DELETE /api/lessons/:id/complete`
Bỏ đánh dấu hoàn thành (khi học viên bấm nhầm).

- **Quyền:** `student` (own)

**200 OK** — response có `lessonId`, `enrollmentId`, `state="not_started"`, `completedAt=null`,
`progressPercent` mới và `createdLearningEventIds=[]`. Dòng progress được giữ lại, không xoá lịch sử.

**Lỗi thường gặp:** `404`, `403`.

#### `GET /api/courses/:id/progress`
Tiến độ tổng hợp theo khoá học (bản rút gọn của `GET /api/enrollments/:id/progress`).

- **Quyền:** `student` (own); `teacher` (assigned) hoặc `admin` cần truyền `userId`.
- **Query:** `userId` (UUID, bắt buộc với teacher/admin; học viên không được đọc user khác)

**200 OK**

```json
{
  "error": false,
  "data": {"courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","progressPercent":45.5,"completedLessons":14,"totalLessons":32,"lastActivityAt":"2026-09-25T13:10:00Z","resumeLessonId":"a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d"},
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `404`, `403` (chưa ghi danh).

> `quizAverageScore` và `riskLevel` chưa có ở E4; lần lượt phụ thuộc E5 và E9.

### ExerciseModule — quiz, câu hỏi, lượt làm, bài nộp

> **Trạng thái triển khai E5 (2026-10-03):** các route quiz, câu hỏi, attempt, submission, review và
> feedback trong mục này đã được triển khai. Vì schema baseline không có bảng `quiz_attempts`, một
> dòng `submissions` trạng thái `in_progress` là lượt làm; `attemptId` chính là `submission.id`.
> `openAt`/`closeAt` ánh xạ tới `quizzes.available_from`/`due_at`; không phát sinh migration. V1 chỉ
> tạo và tự chấm `single_choice`, `multiple_choice`, `true_false`; `short_answer`/`essay` chưa được hỗ
> trợ trong luồng làm bài tự động. Frontend lưu đáp án đang chọn cục bộ theo attempt, không ghi nháp
> lên server.

#### `GET /api/quizzes`
Danh sách quiz (lọc theo khoá học/bài học/trạng thái).

- **Quyền:** `student` thấy quiz `published` của khoá đã ghi danh; `teacher` (assigned)/`admin` thấy mọi trạng thái
- **Query:** `page`, `take`, `search` (khớp `title`), `courseId`, `lessonId`, `status` (`draft,published,closed`), `sortBy` (`createdAt`\|`title`\|`openAt`), `order`

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": [
      {
        "id": "5e6f7081-92a3-4b4c-8d5e-6f708192a3b4",
        "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
        "lessonId": null,
        "title": "Kiểm tra giữa kỳ — Chương 1-2",
        "description": "20 câu trắc nghiệm, thời gian 30 phút.",
        "status": "published",
        "timeLimitMinutes": 30,
        "maxAttempts": 2,
        "questionCount": 20,
        "totalPoints": 10,
        "passScore": 5,
        "shuffleQuestions": true,
        "openAt": "2026-09-25T00:00:00Z",
        "closeAt": "2026-10-05T16:59:59Z",
        "myBestScore": 8.5,
        "myAttemptCount": 1,
        "createdAt": "2026-09-22T02:00:00Z",
        "updatedAt": "2026-09-24T03:00:00Z"
      }
    ],
    "meta": {"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `400`, `403` (lọc theo khoá không thuộc phạm vi).

#### `POST /api/quizzes`
Tạo quiz mới.

- **Quyền:** `teacher` (assigned), `admin`

```json
{
  "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
  "lessonId": null,
  "title": "Kiểm tra giữa kỳ — Chương 1-2",
  "description": "20 câu trắc nghiệm, thời gian 30 phút.",
  "timeLimitMinutes": 30,
  "maxAttempts": 2,
  "passScore": 5,
  "shuffleQuestions": true,
  "openAt": "2026-09-25T00:00:00Z",
  "closeAt": "2026-10-05T16:59:59Z"
}
```

| Field | Bắt buộc | Ràng buộc |
|---|---|---|
| `courseId` | ✔ | UUID khoá học mình phụ trách |
| `title` | ✔ | 3–200 ký tự |
| `timeLimitMinutes` | ✖ | `1`–`300`; `null` = không giới hạn thời gian |
| `maxAttempts` | ✖ | `1`–`10`, mặc định `1` |
| `passScore` | ✖ | `0`–`10` |
| `shuffleQuestions` | ✖ | boolean, mặc định `false` |
| `openAt` / `closeAt` | ✖ | ISO 8601; `closeAt > openAt` |

**201 Created** — trả object quiz; `status` mặc định `'draft'`.

**Lỗi thường gặp:** `400` (`closeAt` ≤ `openAt`), `404`, `403`.

#### `GET /api/quizzes/:id`
Chi tiết quiz. Với học viên, **không trả `isCorrect`** của đáp án trước khi nộp.

- **Quyền:** `student` (quiz published + đã ghi danh), `teacher` (assigned), `admin`

**200 OK** — object quiz (như trong danh sách) + `questions` (rút gọn: `id`, `content`, `type`, `points`, `orderIndex`, `options` không kèm `isCorrect` khi là học viên chưa nộp).

**Lỗi thường gặp:** `404`, `403`.

#### `PATCH /api/quizzes/:id`
Cập nhật quiz.

- **Quyền:** `teacher` (assigned), `admin`

```json
{"title":"Kiểm tra giữa kỳ (bản cập nhật)","timeLimitMinutes":45,"status":"published"}
```

**200 OK** — object quiz sau cập nhật.

**Lỗi thường gặp:** `404`, `403`, `409` (sửa cấu trúc quiz đã có bài nộp — đề xuất chặn sửa `questionCount`/đáp án).

#### `DELETE /api/quizzes/:id`
Xoá quiz (kèm câu hỏi/đáp án/lượt làm nếu chưa có bài nộp).

- **Quyền:** `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "success": true }, "message": "Đã xoá bài kiểm tra" }`

**Lỗi thường gặp:** `409` `"Không thể xoá bài kiểm tra đã có bài nộp."`, `404`, `403`.

#### `PATCH /api/quizzes/:id/publish`
Công bố quiz cho học viên.

- **Quyền:** `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "id": "...", "status": "published", "updatedAt": "..." }, "message": "Đã công bố bài kiểm tra" }`

**Lỗi thường gặp:** `400` `"Bài kiểm tra phải có ít nhất một câu hỏi."`, `404`, `403`.

#### `GET /api/quizzes/:id/questions`
Danh sách câu hỏi kèm đáp án (**chỉ giảng viên/admin** — có `isCorrect`).

- **Quyền:** `teacher` (assigned), `admin`

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": [
      {
        "id": "6f708192-a3b4-4c5d-8e6f-708192a3b4c5",
        "quizId": "5e6f7081-92a3-4b4c-8d5e-6f708192a3b4",
        "content": "Kiểu dữ liệu nào lưu số nguyên trong C++?",
        "type": "single_choice",
        "points": 0.5,
        "orderIndex": 1,
        "explanation": "int lưu số nguyên; float lưu số thực.",
        "options": [{"id":"708192a3-b4c5-4d6e-8f70-8192a3b4c5d6","content":"int","isCorrect":true,"orderIndex":1},{"id":"8192a3b4-c5d6-4e7f-8a81-92a3b4c5d6e7","content":"float","isCorrect":false,"orderIndex":2}],
        "createdAt": "2026-09-22T02:10:00Z",
        "updatedAt": "2026-09-22T02:10:00Z"
      }
    ],
    "meta": {"page":1,"take":100,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `404`, `403`.

#### `POST /api/quizzes/:id/questions`
Thêm câu hỏi vào quiz.

- **Quyền:** `teacher` (assigned), `admin`

```json
{
  "content": "Kiểu dữ liệu nào lưu số nguyên trong C++?",
  "type": "single_choice",
  "points": 0.5,
  "explanation": "int lưu số nguyên; float lưu số thực.",
  "options": [{"content":"int","isCorrect":true},{"content":"float","isCorrect":false},{"content":"string","isCorrect":false}]
}
```

**201 Created** — trả object câu hỏi kèm `options` (có `isCorrect`).

**Lỗi thường gặp:** `400` (`single_choice`/`true_false` phải có **đúng một** `isCorrect: true`; `multiple_choice` phải có **ít nhất một**; tối thiểu 2 đáp án), `404`, `403`.

#### `PATCH /api/questions/:id`
Cập nhật câu hỏi (nội dung, điểm, thứ tự, giải thích).

- **Quyền:** `teacher` (assigned), `admin`

```json
{"content":"Trong C++, kiểu nào lưu số nguyên?","points":1,"orderIndex":2}
```

**200 OK** — object câu hỏi sau cập nhật.

**Lỗi thường gặp:** `404`, `403`, `409` (câu hỏi đã có bài nộp — đề xuất chỉ cho sửa `explanation`).

#### `DELETE /api/questions/:id`
Xoá câu hỏi.

- **Quyền:** `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "success": true }, "message": "Đã xoá câu hỏi" }`

**Lỗi thường gặp:** `404`, `403`, `409` (đã có bài nộp).

#### `POST /api/questions/:id/options`
Thêm đáp án cho câu hỏi.

- **Quyền:** `teacher` (assigned), `admin`

```json
{"content":"char","isCorrect":false}
```

**201 Created** — `{ "error": false, "data": { "id": "...", "questionId": "...", "content": "char", "isCorrect": false, "orderIndex": 4, "createdAt": "...", "updatedAt": "..." }, "message": "Đã thêm đáp án" }`

**Lỗi thường gặp:** `400` (vượt số đáp án tối đa 10, hoặc vi phạm ràng buộc `isCorrect`), `404`, `403`.

#### `PATCH /api/options/:id`
Cập nhật đáp án (nội dung, đúng/sai, thứ tự).

- **Quyền:** `teacher` (assigned), `admin`

```json
{"content":"char (1 byte)","isCorrect":false}
```

**200 OK** — object đáp án sau cập nhật.

**Lỗi thường gặp:** `400` (làm mất đáp án đúng duy nhất của câu `single_choice`), `404`, `403`.

#### `DELETE /api/options/:id`
Xoá đáp án.

- **Quyền:** `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "success": true }, "message": "Đã xoá đáp án" }`

**Lỗi thường gặp:** `400` (còn lại < 2 đáp án), `404`, `403`.

#### `PATCH /api/quizzes/:id/questions/reorder`
Sắp xếp lại thứ tự câu hỏi trong quiz.

- **Quyền:** `teacher` (assigned), `admin`

```json
{"items":[{"id":"6f708192-a3b4-4c5d-8e6f-708192a3b4c5","orderIndex":1}]}
```

**200 OK** — `{ "error": false, "data": { "updated": 1 }, "message": "Đã cập nhật thứ tự câu hỏi" }`

**Lỗi thường gặp:** `400`, `404` (câu hỏi không thuộc quiz), `403`.

#### `POST /api/quizzes/:id/attempts`
Bắt đầu một lượt làm bài (tạo `quiz_attempt` ở trạng thái `in_progress`).

- **Quyền:** `student` (own, đã ghi danh, quiz đang trong thời gian mở)

```json
{}
```

**201 Created**

```json
{
  "error": false,
  "data": {
    "id": "92a3b4c5-d6e7-4f80-9a92-a3b4c5d6e7f8",
    "quizId": "5e6f7081-92a3-4b4c-8d5e-6f708192a3b4",
    "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
    "attemptNo": 2,
    "status": "in_progress",
    "startedAt": "2026-09-26T09:00:00Z",
    "expiresAt": "2026-09-26T09:30:00Z",
    "questions": {"id":"6f708192-a3b4-4c5d-8e6f-708192a3b4c5","content":"Kiểu dữ liệu nào lưu số nguyên trong C++?","type":"single_choice","points":0.5,"orderIndex":1,"options":[{"id":"708192a3-b4c5-4d6e-8f70-8192a3b4c5d6","content":"int","orderIndex":1},{"id":"8192a3b4-c5d6-4e7f-8a81-92a3b4c5d6e7","content":"float","orderIndex":2}]},
    "createdAt": "2026-09-26T09:00:00Z",
    "updatedAt": "2026-09-26T09:00:00Z"
  },
  "message": "Bắt đầu làm bài thành công"
}
```

**Lỗi thường gặp:** `400` `"Bài kiểm tra chưa mở hoặc đã đóng."`, `403` `"Bạn chưa ghi danh khoá học này."`, `409` `"Bạn đã hết số lần làm bài."`, `409` (đang có lượt `in_progress` → trả lại lượt đang làm thay vì tạo mới — nhóm chốt ở mục 13, câu hỏi 5).

#### `GET /api/attempts/:id`
Xem trạng thái một lượt làm (dùng để khôi phục khi tải lại trang hoặc khi hết giờ).

- **Quyền:** `student` (own), `teacher` (assigned), `admin`

**200 OK** — object lượt làm kèm `questions` (không kèm `isCorrect`) và `answers` đã lưu tạm (nếu có).

**Lỗi thường gặp:** `404`, `403`.

#### `GET /api/quizzes/:id/attempts`
Danh sách lượt làm của một quiz.

- **Quyền:** `student` (own — chỉ lượt của mình), `teacher` (assigned), `admin`
- **Query:** `page`, `take`, `userId` (teacher/admin), `status` (`in_progress,submitted,expired`), `sortBy` (`startedAt`\|`score`), `order`

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": {"id":"92a3b4c5-d6e7-4f80-9a92-a3b4c5d6e7f8","quizId":"5e6f7081-92a3-4b4c-8d5e-6f708192a3b4","student":{"id":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","fullName":"Nguyễn Văn A"},"attemptNo":1,"status":"submitted","score":8.5,"startedAt":"2026-09-25T09:00:00Z","submittedAt":"2026-09-25T09:24:11Z","durationSeconds":1451,"createdAt":"2026-09-25T09:00:00Z","updatedAt":"2026-09-25T09:24:11Z"},
    "meta": {"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `404`, `403`.

#### `POST /api/submissions`
Nộp bài: gửi toàn bộ đáp án của một lượt làm; hệ thống **chấm tự động** và trả kết quả ngay.

- **Quyền:** `student` (own)

```json
{
  "attemptId": "92a3b4c5-d6e7-4f80-9a92-a3b4c5d6e7f8",
  "answers": [{"questionId":"6f708192-a3b4-4c5d-8e6f-708192a3b4c5","selectedOptionIds":["708192a3-b4c5-4d6e-8f70-8192a3b4c5d6"]},{"questionId":"8192a3b4-c5d6-4e7f-8a81-92a3b4c5d6e7","selectedOptionIds":["92a3b4c5-d6e7-4f80-9a92-a3b4c5d6e7f8","a3b4c5d6-e7f8-4091-8aa3-b4c5d6e7f809"]}]
}
```

| Field | Bắt buộc | Ràng buộc |
|---|---|---|
| `attemptId` | ✔ | UUID lượt làm `in_progress` thuộc chính người gọi |
| `answers` | ✔ | Mảng ≥ 1; mỗi phần tử có `questionId` (thuộc quiz) và `selectedOptionIds` (câu `single_choice`/`true_false` gửi **đúng 1** phần tử; `multiple_choice` gửi ≥ 1) |
| `answers[].textAnswer` | ✖ | Dự trữ cho câu tự luận — **chưa nằm trong phạm vi v1** (đề xuất) |

**201 Created**

```json
{
  "error": false,
  "data": {"id":"a3b4c5d6-e7f8-4091-8aa3-b4c5d6e7f809","attemptId":"92a3b4c5-d6e7-4f80-9a92-a3b4c5d6e7f8","quizId":"5e6f7081-92a3-4b4c-8d5e-6f708192a3b4","userId":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","status":"graded","score":8.5,"maxScore":10,"correctCount":17,"totalQuestions":20,"passed":true,"autoGraded":true,"submittedAt":"2026-09-25T09:24:11Z","gradedAt":"2026-09-25T09:24:11Z","attemptNo":1,"createdAt":"2026-09-25T09:24:11Z","updatedAt":"2026-09-25T09:24:11Z"},
  "message": "Nộp bài thành công. Điểm của bạn: 8.5/10"
}
```

**Lỗi thường gặp:** `400` (thiếu `attemptId`, đáp án không thuộc quiz), `404`, `403` `"Đây không phải lượt làm bài của bạn."`, `409` `"Lượt làm bài này đã được nộp."` hoặc `"Lượt làm bài đã hết hạn."`.

#### `GET /api/submissions`
Danh sách bài nộp.

- **Quyền:** `student` (own), `teacher` (assigned), `admin`
- **Query:** `page`, `take`, `quizId`, `courseId`, `userId` (teacher/admin), `status` (`submitted,graded,late`), `sortBy` (`submittedAt`\|`score`), `order`

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": {"id":"a3b4c5d6-e7f8-4091-8aa3-b4c5d6e7f809","quiz":{"id":"5e6f7081-92a3-4b4c-8d5e-6f708192a3b4","title":"Kiểm tra giữa kỳ — Chương 1-2"},"student":{"id":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","fullName":"Nguyễn Văn A","studentCode":"SV2026001"},"attemptNo":1,"status":"graded","score":8.5,"maxScore":10,"submittedAt":"2026-09-25T09:24:11Z","hasFeedback":false,"createdAt":"2026-09-25T09:24:11Z","updatedAt":"2026-09-25T09:24:11Z"},
    "meta": {"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `400`, `403`.

#### `GET /api/submissions/:id`
Chi tiết bài nộp (điểm, thời lượng, phản hồi của giảng viên). **Không** kèm đáp án đúng.

- **Quyền:** `student` (own), `teacher` (assigned), `admin`

**200 OK**

```json
{
  "error": false,
  "data": {
    "id": "a3b4c5d6-e7f8-4091-8aa3-b4c5d6e7f809",
    "attemptId": "92a3b4c5-d6e7-4f80-9a92-a3b4c5d6e7f8",
    "quiz": {"id":"5e6f7081-92a3-4b4c-8d5e-6f708192a3b4","title":"Kiểm tra giữa kỳ — Chương 1-2"},
    "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
    "attemptNo": 1,
    "status": "graded",
    "score": 8.5,
    "maxScore": 10,
    "correctCount": 17,
    "totalQuestions": 20,
    "durationSeconds": 1451,
    "submittedAt": "2026-09-25T09:24:11Z",
    "teacherFeedback": null,
    "feedbackAt": null,
    "createdAt": "2026-09-25T09:24:11Z",
    "updatedAt": "2026-09-25T09:24:11Z"
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `404`, `403`.

#### `GET /api/submissions/:id/review`
Xem lại chi tiết từng câu: đáp án đã chọn, đáp án đúng, giải thích — **chỉ sau khi đã nộp** và khi quiz cho phép xem lại.

- **Quyền:** `student` (own), `teacher` (assigned), `admin`
- **Điều kiện (đề xuất):** chỉ trả đáp án đúng khi `quiz.showAnswersAfterSubmit = true` (bổ sung field này vào quiz — đề xuất); nếu không, trả `403` với `"Bài kiểm tra này không cho phép xem lại đáp án."`

**200 OK**

```json
{
  "error": false,
  "data": {"submissionId":"a3b4c5d6-e7f8-4091-8aa3-b4c5d6e7f809","score":8.5,"maxScore":10,"items":[{"questionId":"6f708192-a3b4-4c5d-8e6f-708192a3b4c5","content":"Kiểu dữ liệu nào lưu số nguyên trong C++?","type":"single_choice","points":0.5,"earnedPoints":0.5,"isCorrect":true,"selectedOptionIds":["708192a3-b4c5-4d6e-8f70-8192a3b4c5d6"],"correctOptionIds":["708192a3-b4c5-4d6e-8f70-8192a3b4c5d6"],"explanation":"int lưu số nguyên; float lưu số thực."}]},
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `404`, `403`, `400` (bài nộp chưa được chấm xong).

#### `PATCH /api/submissions/:id/feedback`
Giảng viên cho điểm thủ công và/hoặc gửi phản hồi cho bài nộp.

- **Quyền:** `teacher` (assigned), `admin`

```json
{"score":9,"teacherFeedback":"Trình bày tốt, chú ý câu 12 và 18."}
```

**200 OK** — `{ "error": false, "data": { "id": "...", "score": 9, "status": "graded", "teacherFeedback": "Trình bày tốt, chú ý câu 12 và 18.", "feedbackAt": "2026-09-26T02:00:00.000Z", "updatedAt": "..." }, "message": "Đã gửi phản hồi" }`

**Lỗi thường gặp:** `400` (`score` ngoài `0..maxScore`), `404`, `403`. Việc sửa điểm ghi `audit_logs` (đề xuất).

### LearningActivityModule — telemetry hành vi (`/api/learning-events`)

#### `POST /api/learning-events` — **theo lô (batch)**
Ghi nhận nhiều sự kiện hành vi trong **một** request để không chặn UX. Endpoint này **phải nhanh** và chấp nhận **fire-and-forget**: server **không** chờ analytics/AI, chỉ validate nhẹ + `INSERT` lô rồi trả về.

- **Quyền:** đã đăng nhập (mọi vai trò). `userId` **luôn lấy từ token**, client gửi `userId` khác → bị bỏ qua.
- **Đặc tính:** idempotent theo `clientEventId`; không gọi đồng bộ sang FastAPI (**bắt buộc** theo `docs/architecture.md` mục 2).
- **Giới hạn lô (đề xuất):** tối đa **50 sự kiện/lô**; tối đa **1 request/giây/người dùng**; tổng payload tối đa **256 KB**. Vượt → `413`/`429`.
- **Hành vi khi lỗi:** client **không** retry vô hạn; FE nên gộp lại và gửi lô sau (đề xuất tối đa 3 lần thử, backoff 2s/5s/15s).

```json
{
  "events": [
    {"clientEventId":"1f7c9a10-3b2e-4d51-9c8a-7e6f5d4c3b2a","eventType":"lesson_started","occurredAt":"2026-09-26T09:00:00Z","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","lessonId":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","durationSeconds":null,"metadata":{"device":"desktop","source":"course-content-page"}},
    {"clientEventId":"2f7c9a10-3b2e-4d51-9c8a-7e6f5d4c3b2b","eventType":"video_watched","occurredAt":"2026-09-26T09:12:40Z","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","lessonId":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","durationSeconds":480,"metadata":{"watchedRatio":0.67,"positionSeconds":480}}
  ]
}
```

| Field | Bắt buộc | Ràng buộc |
|---|---|---|
| `events` | ✔ | Mảng 1–50 phần tử |
| `events[].clientEventId` | ✖ (khuyến nghị) | UUID do client sinh — dùng để chống ghi trùng |
| `events[].eventType` | ✔ | `LearningEventType` (union ở 3.3) |
| `events[].occurredAt` | ✔ | ISO 8601, **không được ở tương lai quá 5 phút** (đề xuất), không cũ hơn 30 ngày (đề xuất) |
| `events[].courseId` | ✖ | UUID khoá học liên quan |
| `events[].lessonId` | ✖ | UUID bài học liên quan |
| `events[].quizId` | ✖ | UUID quiz (với `quiz_started`/`quiz_submitted`) |
| `events[].durationSeconds` | ✖ | Số nguyên `0`–`86400` |
| `events[].metadata` | ✖ | Object tự do, tối đa **2 KB** sau khi serialize (đề xuất) |

**202 Accepted** (đề xuất dùng `202` vì xử lý là fire-and-forget; nếu nhóm muốn đơn giản thì dùng `201`)

```json
{"error":false,"data":{"accepted":2,"rejected":0,"duplicated":0,"receivedAt":"2026-09-26T09:13:00.1Z"},"message":"Đã ghi nhận sự kiện"}
```

**Lỗi thường gặp:** `400` (lô rỗng/sai `eventType`/`occurredAt` sai định dạng), `413` (lô > 50 sự kiện hoặc payload > 256 KB), `429` `"Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút."` (đề xuất 1 req/s/user, burst 5).

> **Ràng buộc thiết kế:** endpoint này **không** được `await` bất kỳ lời gọi FastAPI hay tổng hợp analytics nào. Nếu cần tính toán nặng, đẩy vào BullMQ (xem mục 8).

#### `GET /api/learning-events`
Đọc log sự kiện hành vi thô (phục vụ debug và kiểm tra dữ liệu vào model).

- **Quyền:** `admin` (đề xuất: chỉ `admin`; giảng viên dùng dashboard analytics thay vì log thô)
- **Query:** `page`, `take`, `userId`, `courseId`, `lessonId`, `eventType` (nhiều giá trị phân tách bằng dấu phẩy), `from`, `to`, `sortBy` (`occurredAt`\|`createdAt`), `order` (mặc định `desc`)

```http
GET /api/learning-events?userId=8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601&eventType=lesson_started,lesson_completed&from=2026-09-01&to=2026-09-26&page=1&take=50
```

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": {"id":"3c4d5e6f-7081-492a-8b3c-4d5e6f708192","userId":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","eventType":"lesson_completed","occurredAt":"2026-09-26T09:12:40Z","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","lessonId":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","durationSeconds":480,"metadata":{"watchedRatio":0.67},"createdAt":"2026-09-26T09:13:00.1Z","updatedAt":"2026-09-26T09:13:00.1Z"},
    "meta": {"page":1,"take":50,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `400` (`from`/`to` sai), `403`.

### DiscussionModule **(đề xuất)** — thảo luận (`/api/discussion-threads`, `/api/discussion-posts`)

> `docs/architecture.md` không liệt kê module thảo luận; đề xuất tách `DiscussionModule` (nếu không, đặt trong `CourseModule`). Endpoint giữ nguyên như dưới.

#### `GET /api/discussion-threads`
Danh sách chủ đề thảo luận (theo bài học hoặc khoá học).

- **Quyền:** đã đăng nhập
- **Query:** `page`, `take`, `search` (khớp `title`), `courseId`, `lessonId`, `createdBy`, `sortBy` (`createdAt`\|`replyCount`\|`lastActivityAt`), `order`

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": {"id":"b4c5d6e7-f809-41a2-9bb4-c5d6e7f8091a","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","lessonId":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","title":"Cho em hỏi về con trỏ trong C++","author":{"id":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","fullName":"Nguyễn Văn A","role":"student"},"postCount":4,"isPinned":false,"isLocked":false,"lastActivityAt":"2026-09-26T07:30:00Z","createdAt":"2026-09-25T15:00:00Z","updatedAt":"2026-09-26T07:30:00Z"},
    "meta": {"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `400`.

#### `POST /api/discussion-threads`
Tạo chủ đề thảo luận mới.

- **Quyền:** đã đăng nhập

```json
{
  "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
  "lessonId": "f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192",
  "title": "Cho em hỏi về con trỏ trong C++",
  "content": "Em chưa hiểu phần cấp phát động, mong thầy/cô giải thích thêm."
}
```

**201 Created** — trả object thread + `content` của bài viết đầu tiên.

**Lỗi thường gặp:** `404` (khoá/bài học không tồn tại), `403` (chưa ghi danh khoá — đề xuất), `400`.

#### `GET /api/discussion-threads/:id`
Chi tiết chủ đề kèm các bài trả lời (phân trang).

- **Quyền:** đã đăng nhập
- **Query:** `page`, `take`, `sortBy` (`createdAt`), `order` (mặc định `asc`)

**200 OK** — object thread + `posts: { items, meta }`.

**Lỗi thường gặp:** `404`.

#### `PATCH /api/discussion-threads/:id`
Sửa tiêu đề/nội dung chủ đề (chủ sở hữu) hoặc ghim/khoá (kiểm duyệt).

- **Quyền:** chủ sở hữu (own), `teacher` (assigned), `admin`

```json
{"title":"Hỏi về con trỏ và cấp phát động trong C++","isPinned":true,"isLocked":false}
```

**200 OK** — object thread sau cập nhật.

**Lỗi thường gặp:** `404`, `403`, `400`.

#### `DELETE /api/discussion-threads/:id`
Xoá chủ đề (kèm bài trả lời).

- **Quyền:** chủ sở hữu (own), `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "success": true }, "message": "Đã xoá chủ đề" }`

**Lỗi thường gặp:** `404`, `403`.

#### `GET /api/discussion-threads/:id/posts`
Danh sách bài trả lời của chủ đề.

- **Quyền:** đã đăng nhập
- **Query:** `page`, `take`, `sortBy` (`createdAt`), `order`

**200 OK**

```json
{
  "error": false,
  "data": {"items":[{"id":"c5d6e7f8-091a-42b3-8cc5-d6e7f8091a2b","threadId":"b4c5d6e7-f809-41a2-9bb4-c5d6e7f8091a","parentPostId":null,"content":"Con trỏ là biến lưu địa chỉ ô nhớ...","author":{"id":"1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d","fullName":"Trần Thị B","role":"teacher"},"isEdited":false,"isHidden":false,"reportCount":0,"createdAt":"2026-09-26T07:30:00Z","updatedAt":"2026-09-26T07:30:00Z"}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `404`.

#### `POST /api/discussion-threads/:id/posts`
Trả lời trong chủ đề (hỗ trợ trả lời lồng một cấp qua `parentPostId`).

- **Quyền:** đã đăng nhập (chủ đề không bị khoá)

```json
{"content":"Em đã hiểu, cảm ơn thầy/cô.","parentPostId":"c5d6e7f8-091a-42b3-8cc5-d6e7f8091a2b"}
```

**201 Created** — trả object bài viết.

**Lỗi thường gặp:** `400` (`content` rỗng/quá 5000 ký tự), `404`, `409` `"Chủ đề này đã bị khoá."`.

#### `PATCH /api/discussion-posts/:id`
Sửa bài viết.

- **Quyền:** chủ sở hữu (own), `admin`

```json
{"content":"Nội dung đã chỉnh sửa..."}
```

**200 OK** — object bài viết với `isEdited: true`.

**Lỗi thường gặp:** `404`, `403`.

#### `DELETE /api/discussion-posts/:id`
Xoá bài viết.

- **Quyền:** chủ sở hữu (own), `teacher` (assigned), `admin`

**200 OK** — `{ "error": false, "data": { "success": true }, "message": "Đã xoá bài viết" }`

**Lỗi thường gặp:** `404`, `403`.

#### `POST /api/discussion-posts/:id/report`
Báo cáo bài viết vi phạm (tạo `content_reports`).

- **Quyền:** đã đăng nhập

```json
{"reason":"spam","detail":"Nội dung quảng cáo ngoài lề."}
```

| Field | Bắt buộc | Ràng buộc |
|---|---|---|
| `reason` | ✔ | `'spam' \| 'offensive' \| 'off_topic' \| 'other'` (đề xuất union) |
| `detail` | ✖ | tối đa 500 ký tự |

**201 Created** — `{ "error": false, "data": { "id": "...", "status": "pending", "createdAt": "..." }, "message": "Đã gửi báo cáo, cảm ơn bạn." }`

**Lỗi thường gặp:** `404`, `409` `"Bạn đã báo cáo bài viết này."`.

#### `PATCH /api/discussion-posts/:id/moderate`
Kiểm duyệt bài viết: ẩn hoặc khôi phục.

- **Quyền:** `admin` (đề xuất cho `admin`; `teacher` chỉ trong khoá mình phụ trách)

```json
{"isHidden":true,"reason":"Nội dung không phù hợp"}
```

**200 OK** — `{ "error": false, "data": { "id": "...", "isHidden": true, "updatedAt": "..." }, "message": "Đã ẩn bài viết" }`

**Lỗi thường gặp:** `404`, `403`.

### AnalyticsModule (`/api/analytics`)

> Các endpoint này là **truy vấn tổng hợp nặng**. Đề xuất phục vụ bằng **materialized view** (refresh định kỳ) hoặc cache Redis TTL ngắn, không tính lại mỗi request (theo `docs/architecture.md` mục 4 — "aggregation queries, có thể dùng materialized view"). Response nên kèm `computedAt` + `dataFreshnessSeconds` **(đề xuất)** để FE hiển thị độ mới của số liệu.

#### `GET /api/analytics/courses/:id/overview`
Tổng quan một khoá học: số học viên, tỷ lệ hoàn thành, điểm trung bình, mức độ tương tác.

- **Quyền:** `teacher` (assigned), `admin`

**200 OK**

```json
{
  "error": false,
  "data": {"courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","courseName":"Nhập môn lập trình","enrolledCount":148,"activeLearners7d":96,"completionRate":0.42,"averageProgressPercent":45.5,"averageScore":7.1,"averageTimePerLessonSeconds":615,"atRiskCount":12,"riskDistribution":{"low":110,"medium":26,"high":12},"computedAt":"2026-09-26T08:00:00Z","dataFreshnessSeconds":3600},
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `404`, `403` `"Bạn không phụ trách khoá học này."`.

#### `GET /api/analytics/courses/:id/trends`
Chuỗi thời gian hành vi/kết quả của khoá học (dữ liệu cho biểu đồ đường).

- **Quyền:** `teacher` (assigned), `admin`
- **Query:**

| Tham số | Bắt buộc | Mô tả |
|---|---|---|
| `from` | ✔ | `YYYY-MM-DD` hoặc ISO 8601 |
| `to` | ✔ | `YYYY-MM-DD` hoặc ISO 8601; `to ≥ from`; khoảng tối đa **366 ngày** (đề xuất) |
| `granularity` | ✖ | `'day' \| 'week'`, mặc định `'day'` |
| `metrics` | ✖ | Danh sách phân tách bằng dấu phẩy: `activeLearners`, `lessonCompletions`, `quizSubmissions`, `averageScore` — mặc định tất cả |

```http
GET /api/analytics/courses/b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f/trends?from=2026-09-01&to=2026-09-26&granularity=day&metrics=activeLearners,lessonCompletions,averageScore
```

**200 OK**

```json
{
  "error": false,
  "data": {
    "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
    "from": "2026-09-01",
    "to": "2026-09-26",
    "granularity": "day",
    "points": [{"bucket":"2026-09-24","activeLearners":88,"lessonCompletions":130,"quizSubmissions":41,"averageScore":7.05},{"bucket":"2026-09-25","activeLearners":93,"lessonCompletions":152,"quizSubmissions":55,"averageScore":7.18},{"bucket":"2026-09-26","activeLearners":71,"lessonCompletions":96,"quizSubmissions":28,"averageScore":7.22}],
    "computedAt": "2026-09-26T08:05:00Z",
    "dataFreshnessSeconds": 3600
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `400` (`from`/`to` thiếu hoặc `from > to`), `403`.

#### `GET /api/analytics/courses/:id/cohort-comparison`
So sánh khoá học với mặt bằng chung (cohort) theo từng chỉ số.

- **Quyền:** `teacher` (assigned), `admin`
- **Query:** `from`, `to` (không bắt buộc; mặc định 30 ngày gần nhất), `cohortBy` (`semester`\|`category`\|`all`, mặc định `semester`) (đề xuất)

**200 OK**

```json
{
  "error": false,
  "data": {
    "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
    "cohortBy": "semester",
    "cohortLabel": "1/2026-2027",
    "metrics": [{"metric":"completionRate","courseValue":0.42,"cohortAverage":0.38,"delta":0.04,"courseRank":4,"cohortSize":11},{"metric":"averageScore","courseValue":7.1,"cohortAverage":6.8,"delta":0.3,"courseRank":3,"cohortSize":11},{"metric":"activeLearners7d","courseValue":96,"cohortAverage":101.2,"delta":-5.2,"courseRank":7,"cohortSize":11}],
    "computedAt": "2026-09-26T08:05:00Z",
    "dataFreshnessSeconds": 3600
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `404`, `403`, `400`.

#### `GET /api/analytics/learners/:id/timeline`
Dòng thời gian hoạt động của một học viên (sự kiện học tập + kết quả) — dùng cho trang chi tiết học viên của giảng viên.

- **Quyền:** `student` (own), `teacher` (assigned), `admin`
- **Query:** `from`, `to` (mặc định 30 ngày gần nhất), `page`, `take`, `eventTypes` (danh sách phân tách bằng dấu phẩy)

**200 OK**

```json
{
  "error": false,
  "data": {
    "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
    "from": "2026-08-27",
    "to": "2026-09-26",
    "summary": {"activeDays":18,"lessonsCompleted":14,"quizSubmissions":5,"averageScore":7.85,"totalTimeSeconds":21600,"lastActivityAt":"2026-09-26T09:12:40Z","daysSinceLastActivity":0},
    "items": [{"occurredAt":"2026-09-26T09:12:40Z","eventType":"lesson_completed","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","lessonId":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","durationSeconds":480,"score":null},{"occurredAt":"2026-09-25T09:24:11Z","eventType":"quiz_submitted","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","lessonId":null,"durationSeconds":1451,"score":8.5}],
    "meta": {"page":1,"take":20,"itemCount":2,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false},
    "computedAt": "2026-09-26T10:00:00Z",
    "dataFreshnessSeconds": 900
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `404`, `403` `"Bạn chỉ có thể xem dữ liệu của chính mình."`.

#### `GET /api/analytics/courses/:id/at-risk`
Danh sách học viên có nguy cơ chậm tiến độ **kèm lý do** (explainability) — dữ liệu chính cho dashboard giảng viên.

- **Quyền:** `teacher` (assigned), `admin`
- **Query:**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `page`, `take` | number | Phân trang (`take` tối đa 100) |
| `riskLevel` | `low,medium,high` | Lọc mức rủi ro; mặc định `medium,high` |
| `minRiskScore` | number | `0`–`1`; lọc theo điểm rủi ro tối thiểu |
| `sortBy` | `riskScore`\|`computedAt`\|`fullName` | Mặc định `riskScore` |
| `order` | `asc`\|`desc` | Mặc định `desc` |
| `search` | string | Khớp `fullName`, `studentCode`, `email` |
| `modelVersion` | string | Lọc theo phiên bản model (mặc định: mới nhất) |

```http
GET /api/analytics/courses/b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f/at-risk?riskLevel=medium,high&sortBy=riskScore&order=desc&page=1&take=20
```

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": [
      {
        "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
        "fullName": "Nguyễn Văn A",
        "studentCode": "SV2026001",
        "email": "sv2026001@hcmut.edu.vn",
        "riskScore": 0.78,
        "riskLevel": "high",
        "contributingFactors": [{"feature":"days_since_last_activity","label":"Số ngày kể từ lần học gần nhất","value":9,"weight":0.31,"direction":"increases_risk"},{"feature":"completion_rate_vs_expected","label":"Tỷ lệ hoàn thành so với lộ trình","value":0.35,"weight":0.27,"direction":"increases_risk"},{"feature":"score_trend","label":"Xu hướng điểm số","value":-0.12,"weight":0.2,"direction":"increases_risk"}],
        "modelVersion": "rule-based-v1",
        "computedAt": "2026-09-26T06:00:00Z",
        "progressPercent": 35,
        "averageScore": 5.4,
        "lastActivityAt": "2026-09-17T10:00:00Z",
        "openInterventionId": null
      }
    ],
    "meta": {"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false},
    "computedAt": "2026-09-26T08:05:00Z",
    "dataFreshnessSeconds": 3600
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `400` (`minRiskScore` ngoài khoảng, `riskLevel` sai union), `404`, `403`. Nếu **chưa có** kết quả dự đoán nào cho khoá: trả `200` với `items: []` và message `"Chưa có dữ liệu dự đoán cho khoá học này."` (đề xuất — tránh FE phải xử lý `404` như một lỗi).

#### `GET /api/analytics/me/overview`
Tổng quan học tập của **chính người gọi** (dữ liệu cho màn hình "tiến độ của tôi" và cảnh báo cá nhân).

- **Quyền:** `student` (own)

**200 OK**

```json
{
  "error": false,
  "data": {
    "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
    "enrolledCourses": 3,
    "completedLessons": 24,
    "totalLessons": 58,
    "progressPercent": 41.4,
    "averageScore": 7.85,
    "activeDaysLast7": 4,
    "currentStreakDays": 2,
    "riskLevel": "medium",
    "riskReasons": [{"label":"Bạn chưa vào học 3 ngày qua","feature":"days_since_last_activity"},{"label":"Tỷ lệ hoàn thành thấp hơn trung bình lớp","feature":"completion_rate_vs_expected"}],
    "nextLessons": {"lessonId":"a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d","title":"Bài 2 — Biến và hằng số","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f"},
    "computedAt": "2026-09-26T08:00:00Z",
    "dataFreshnessSeconds": 3600
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `401`.

### AIGatewayModule (`/api/ai`)

> **Nguyên tắc bắt buộc:** NestJS **không block** chờ FastAPI cho job nặng (`docs/architecture.md` mục 2, 3.3). `POST /api/ai/risk/predict` chỉ **tạo job** và trả `202` ngay; kết quả lấy qua polling `GET /api/ai/jobs/:id` hoặc qua WebSocket (`ai.job.updated`, mục 9).

#### `POST /api/ai/risk/predict`
Tạo job dự đoán rủi ro cho một học viên (hoặc cả khoá) và đẩy vào BullMQ.

- **Quyền:** `teacher` (assigned), `admin`

```json
{"userId":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","jobType":"risk.predict.single","force":false}
```

| Field | Bắt buộc | Ràng buộc |
|---|---|---|
| `userId` | ✔ với `risk.predict.single` | UUID học viên |
| `courseId` | ✖ | UUID khoá học — giới hạn phạm vi feature |
| `jobType` | ✖ | `'risk.predict.single' \| 'risk.predict.batch'`, mặc định `'risk.predict.single'` |
| `force` | ✖ | `true` = bỏ qua cache/kết quả còn mới (mặc định `false`, coi kết quả < 24h là còn hiệu lực — đề xuất) |

**202 Accepted**

```json
{
  "error": false,
  "data": {"jobId":"d6e7f809-1a2b-43c4-8dd6-e7f8091a2b3c","jobType":"risk.predict.single","status":"queued","queueName":"ai-risk","userId":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","requestedBy":"1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d","queuedAt":"2026-09-26T10:10:00Z","pollAfterMs":2000,"createdAt":"2026-09-26T10:10:00Z","updatedAt":"2026-09-26T10:10:00Z"},
  "message": "Đã đưa yêu cầu dự đoán vào hàng đợi"
}
```

**Lỗi thường gặp:** `400` (thiếu `userId` khi `jobType = 'risk.predict.single'`), `403`, `404`, `409` (đã có job cùng `userId` đang `queued`/`running` — đề xuất trả lại job cũ thay vì tạo trùng), `503` `"Dịch vụ phân tích hiện không sẵn sàng, vui lòng thử lại sau."` (Redis/BullMQ lỗi).

#### `GET /api/ai/jobs/:id`
Trạng thái một job AI (dùng cho polling của FE).

- **Quyền:** người tạo job (own), `admin`

**200 OK — job đang chạy**

```json
{
  "error": false,
  "data": {
    "jobId": "d6e7f809-1a2b-43c4-8dd6-e7f8091a2b3c",
    "jobType": "risk.predict.single",
    "status": "running",
    "progress": 40,
    "queueName": "ai-risk",
    "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
    "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
    "requestedBy": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    "attempts": 1,
    "maxAttempts": 3,
    "queuedAt": "2026-09-26T10:10:00Z",
    "startedAt": "2026-09-26T10:10:02Z",
    "finishedAt": null,
    "resultRef": null,
    "errorMessage": null,
    "createdAt": "2026-09-26T10:10:00Z",
    "updatedAt": "2026-09-26T10:10:05Z"
  },
  "message": "Thành công"
}
```

**200 OK — job thành công** (`resultRef` trỏ tới kết quả trong `risk_predictions`; FE gọi tiếp `GET /api/ai/learners/:id/risk` để lấy chi tiết):

```json
{
  "error": false,
  "data": {
    "jobId": "d6e7f809-1a2b-43c4-8dd6-e7f8091a2b3c",
    "jobType": "risk.predict.single",
    "status": "succeeded",
    "progress": 100,
    "queueName": "ai-risk",
    "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
    "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
    "requestedBy": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    "attempts": 1,
    "maxAttempts": 3,
    "queuedAt": "2026-09-26T10:10:00Z",
    "startedAt": "2026-09-26T10:10:02Z",
    "finishedAt": "2026-09-26T10:10:07Z",
    "resultRef": {"predictionId":"e7f8091a-2b3c-44d5-8ee7-f8091a2b3c4d","riskLevel":"high","riskScore":0.78},
    "errorMessage": null,
    "createdAt": "2026-09-26T10:10:00Z",
    "updatedAt": "2026-09-26T10:10:07Z"
  },
  "message": "Thành công"
}
```

**200 OK — job thất bại:** `status: "failed"`, `errorMessage` mô tả lỗi (tiếng Việt, ví dụ `"Không đủ dữ liệu hành vi để dự đoán."`), `resultRef: null`.

**Lỗi thường gặp:** `404` `"Không tìm thấy job với ID <uuid>"`, `403`.

#### `GET /api/ai/jobs`
Danh sách job AI — giám sát vận hành pipeline.

- **Quyền:** `admin` (đề xuất); `teacher` chỉ thấy job do mình tạo
- **Query:** `page`, `take`, `status` (`queued,running,succeeded,failed`), `jobType`, `userId`, `courseId`, `from`, `to`, `sortBy` (`queuedAt`\|`finishedAt`), `order`

**200 OK**

```json
{
  "error": false,
  "data": {"items":[{"jobId":"d6e7f809-1a2b-43c4-8dd6-e7f8091a2b3c","jobType":"risk.predict.batch","status":"succeeded","progress":100,"userId":null,"courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","requestedBy":null,"attempts":1,"queuedAt":"2026-09-26T06:00:00Z","finishedAt":"2026-09-26T06:01:12Z","errorMessage":null,"createdAt":"2026-09-26T06:00:00Z","updatedAt":"2026-09-26T06:01:12Z"}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `400`, `403`.

#### `GET /api/ai/learners/:id/risk`
Kết quả dự đoán rủi ro **mới nhất** của một học viên (kèm giải thích).

- **Quyền:** `student` (own), `teacher` (assigned), `admin`
- **Query:** `courseId` (lọc theo khoá), `includeHistory` (`true` để kèm lịch sử dự đoán — đề xuất)

**200 OK**

```json
{
  "error": false,
  "data": {
    "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
    "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
    "riskScore": 0.78,
    "riskLevel": "high",
    "contributingFactors": [
      {"feature":"days_since_last_activity","label":"Số ngày kể từ lần học gần nhất","value":9,"weight":0.31,"direction":"increases_risk"},
      {"feature":"completion_rate_vs_expected","label":"Tỷ lệ hoàn thành so với lộ trình","value":0.35,"weight":0.27,"direction":"increases_risk"},
      {"feature":"score_trend","label":"Xu hướng điểm số","value":-0.12,"weight":0.2,"direction":"increases_risk"},
      {"feature":"attempt_no_max","label":"Số lần làm lại nhiều nhất","value":2,"weight":0.12,"direction":"increases_risk"}
    ],
    "recommendedActions": {"type":"review_lesson","label":"Ôn lại Chương 2 — Biến và kiểu dữ liệu","lessonId":"a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d"},
    "modelVersion": "rule-based-v1",
    "computedAt": "2026-09-26T06:00:00Z",
    "predictionId": "e7f8091a-2b3c-44d5-8ee7-f8091a2b3c4d",
    "createdAt": "2026-09-26T06:00:00Z",
    "updatedAt": "2026-09-26T06:00:00Z"
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `404` `"Chưa có kết quả dự đoán cho học viên này."` (đề xuất: trả `200` với `data: null` + message mô tả "chưa có dữ liệu" để FE không nhầm với lỗi — nhóm chốt ở mục 13, câu hỏi 6), `403`.

#### `GET /api/ai/models`
Danh sách phiên bản model đang có (để chọn/lọc và để hiển thị model nào sinh ra cảnh báo).

- **Quyền:** `admin`

**200 OK**

```json
{
  "error": false,
  "data": {"items":[{"id":"f8091a2b-3c4d-45e6-8ff8-091a2b3c4d5e","version":"rule-based-v1","algorithm":"rule_based","description":"Bản rule-based đầu tiên: recency + completion rate + score trend.","isActive":true,"trainedAt":null,"metrics":{"precision":null,"recall":null,"f1":null},"createdAt":"2026-09-20T02:00:00Z","updatedAt":"2026-09-20T02:00:00Z"}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `403`.

> `metrics` để `null` khi chưa đánh giá model — **không** điền số liệu giả. Việc đánh giá Precision/Recall nằm trong kế hoạch (`docs/proposal.md` mục 4.3) và chưa có kết quả.

### InterventionModule (`/api/interventions`)

#### `POST /api/interventions`
Tạo can thiệp cho một học viên (nhắn tin, gợi ý bài ôn, gán nhiệm vụ bổ sung).

- **Quyền:** `teacher` (assigned), `admin`

```json
{
  "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
  "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
  "predictionId": "e7f8091a-2b3c-44d5-8ee7-f8091a2b3c4d",
  "type": "message",
  "channel": "in_app",
  "title": "Nhắc xem lại Chương 2",
  "message": "Em chú ý hoàn thành Chương 2 trong tuần này nhé. Nếu vướng phần nào cứ hỏi lại thầy/cô.",
  "recommendedLessonIds": "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d",
  "dueDate": "2026-10-03"
}
```

| Field | Bắt buộc | Ràng buộc |
|---|---|---|
| `userId` | ✔ | UUID học viên thuộc khoá mình phụ trách |
| `courseId` | ✔ | UUID khoá học |
| `predictionId` | ✖ | UUID `risk_predictions` — liên kết can thiệp với lý do rủi ro (phục vụ giải trình) |
| `type` | ✔ | `'message' \| 'review_suggestion' \| 'mentor_assignment'` (đề xuất union) |
| `channel` | ✖ | `'in_app' \| 'email'`, mặc định `'in_app'` |
| `title` | ✔ | 3–200 ký tự |
| `message` | ✔ | 1–2000 ký tự |
| `recommendedLessonIds` | ✖ | Tối đa 10 UUID |
| `dueDate` | ✖ | `YYYY-MM-DD`, không ở quá khứ |

**201 Created**

```json
{
  "error": false,
  "data": {
    "id": "091a2b3c-4d5e-46f7-8009-1a2b3c4d5e6f",
    "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
    "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
    "teacherId": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    "predictionId": "e7f8091a-2b3c-44d5-8ee7-f8091a2b3c4d",
    "type": "message",
    "channel": "in_app",
    "title": "Nhắc xem lại Chương 2",
    "message": "Em chú ý hoàn thành Chương 2 trong tuần này nhé...",
    "recommendedLessonIds": "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d",
    "status": "sent",
    "dueDate": "2026-10-03",
    "sentAt": "2026-09-26T10:20:00Z",
    "acknowledgedAt": null,
    "completedAt": null,
    "createdAt": "2026-09-26T10:20:00Z",
    "updatedAt": "2026-09-26T10:20:00Z"
  },
  "message": "Đã gửi can thiệp tới học viên"
}
```

**Lỗi thường gặp:** `400` (`dueDate` trong quá khứ, `recommendedLessonIds` không thuộc khoá), `403` `"Bạn không phụ trách khoá học này."`, `404`.

#### `GET /api/interventions`
Danh sách can thiệp.

- **Quyền:** `student` (own — chỉ can thiệp gửi cho mình), `teacher` (assigned), `admin`
- **Query:** `page`, `take`, `userId`, `courseId`, `teacherId`, `status` (`pending,sent,acknowledged,completed`), `type`, `from`, `to`, `sortBy` (`createdAt`\|`sentAt`\|`dueDate`), `order`

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": {"id":"091a2b3c-4d5e-46f7-8009-1a2b3c4d5e6f","learner":{"id":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","fullName":"Nguyễn Văn A","studentCode":"SV2026001"},"course":{"id":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","name":"Nhập môn lập trình"},"type":"message","channel":"in_app","title":"Nhắc xem lại Chương 2","status":"sent","dueDate":"2026-10-03","sentAt":"2026-09-26T10:20:00Z","acknowledgedAt":null,"completedAt":null,"createdAt":"2026-09-26T10:20:00Z","updatedAt":"2026-09-26T10:20:00Z"},
    "meta": {"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `403`, `400`.

#### `GET /api/interventions/:id`
Chi tiết một can thiệp.

- **Quyền:** `student` (own), `teacher` (assigned), `admin`

**200 OK** — object can thiệp đầy đủ (kèm `message`, `recommendedLessonIds`, `predictionId`).

**Lỗi thường gặp:** `404`, `403`.

#### `PATCH /api/interventions/:id`
Cập nhật trạng thái can thiệp — theo vòng đời `pending → sent → acknowledged → completed`.

- **Quyền:** học viên nhận can thiệp (chỉ được chuyển sang `acknowledged`), `teacher` (assigned)/`admin` (mọi chuyển trạng thái)

```json
{"status":"acknowledged","note":"Em sẽ hoàn thành trong tuần này."}
```

| Chuyển trạng thái hợp lệ | Ai được làm |
|---|---|
| `pending → sent` | `teacher`/`admin` |
| `sent → acknowledged` | `student` (own) hoặc `teacher`/`admin` |
| `acknowledged → completed` | `student` (own) hoặc `teacher`/`admin` |
| `sent → completed`, `pending → acknowledged` (nhảy cóc) | `teacher`/`admin` (đề xuất: cho phép, ghi `audit_logs`) |

**200 OK** — `{ "error": false, "data": { "id": "...", "status": "acknowledged", "acknowledgedAt": "2026-09-26T12:00:00.000Z", "updatedAt": "..." }, "message": "Đã cập nhật trạng thái can thiệp" }`

**Lỗi thường gặp:** `400` `"Không thể chuyển từ trạng thái 'completed' sang 'pending'."`, `404`, `403`.

#### `GET /api/interventions/:id/history`
Lịch sử thay đổi trạng thái của can thiệp (phục vụ giải trình).

- **Quyền:** `student` (own), `teacher` (assigned), `admin`

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": [
      {"id":"1a2b3c4d-5e6f-47a8-9b0c-1d2e3f4a5b6c","interventionId":"091a2b3c-4d5e-46f7-8009-1a2b3c4d5e6f","fromStatus":"pending","toStatus":"sent","changedBy":{"id":"1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d","fullName":"Trần Thị B","role":"teacher"},"note":null,"createdAt":"2026-09-26T10:20:00Z","updatedAt":"2026-09-26T10:20:00Z"},
      {"id":"2b3c4d5e-6f70-48b9-8c1d-2e3f4a5b6c7d","interventionId":"091a2b3c-4d5e-46f7-8009-1a2b3c4d5e6f","fromStatus":"sent","toStatus":"acknowledged","changedBy":{"id":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","fullName":"Nguyễn Văn A","role":"student"},"note":"Em sẽ hoàn thành trong tuần này.","createdAt":"2026-09-26T12:00:00Z","updatedAt":"2026-09-26T12:00:00Z"}
    ],
    "meta": {"page":1,"take":20,"itemCount":2,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `404`, `403`.

### NotificationModule (`/api/notifications`)

#### `GET /api/notifications`
Danh sách thông báo của người dùng hiện tại.

- **Quyền:** đã đăng nhập (own)
- **Query:** `page`, `take`, `isRead` (`true`\|`false`), `type` (`risk_alert,intervention,system,deadline`), `sortBy` (`createdAt`), `order` (mặc định `desc`)

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": {"id":"3c4d5e6f-7081-49ca-9d2e-3f4a5b6c7d8e","type":"risk_alert","title":"Cảnh báo tiến độ học tập","body":"Bạn chưa vào học 9 ngày. Hãy ôn lại Chương 2 để theo kịp lộ trình.","isRead":false,"readAt":null,"payload":{"courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","riskLevel":"high","interventionId":"091a2b3c-4d5e-46f7-8009-1a2b3c4d5e6f"},"createdAt":"2026-09-26T06:00:05Z","updatedAt":"2026-09-26T06:00:05Z"},
    "meta": {"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false},
    "unreadCount": 1
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `400` (`isRead` không phải boolean).

#### `PATCH /api/notifications/:id/read`
Đánh dấu một thông báo đã đọc (idempotent).

- **Quyền:** đã đăng nhập (own)

**200 OK** — `{ "error": false, "data": { "id": "...", "isRead": true, "readAt": "2026-09-26T13:00:00.000Z", "updatedAt": "..." }, "message": "Đã đánh dấu đã đọc" }`

**Lỗi thường gặp:** `404`, `403` (thông báo của người khác).

#### `PATCH /api/notifications/read-all`
Đánh dấu tất cả thông báo của người dùng là đã đọc.

- **Quyền:** đã đăng nhập (own)

**200 OK** — `{ "error": false, "data": { "updated": 12 }, "message": "Đã đánh dấu tất cả là đã đọc" }`

**Lỗi thường gặp:** `401`.

#### `GET /api/notifications/settings`
Xem cấu hình nhận thông báo của người dùng hiện tại.

- **Quyền:** đã đăng nhập (own)

**200 OK**

```json
{
  "error": false,
  "data": {"userId":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","inAppEnabled":true,"emailEnabled":false,"riskAlertEnabled":true,"interventionEnabled":true,"deadlineReminderEnabled":true,"weeklyDigestEnabled":false,"createdAt":"2026-09-22T04:00:00Z","updatedAt":"2026-09-26T13:05:00Z"},
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `401`.

#### `PATCH /api/notifications/settings`
Cập nhật cấu hình nhận thông báo.

- **Quyền:** đã đăng nhập (own)

```json
{"emailEnabled":true,"weeklyDigestEnabled":true}
```

**200 OK** — trả object cấu hình như `GET`.

**Lỗi thường gặp:** `400` (giá trị không phải boolean).

### AdminModule (`/api/admin`)

#### `GET /api/admin/overview`
Thống kê tổng quan toàn hệ thống (số người dùng, khoá học, ghi danh, tỷ lệ hoàn thành, job AI).

- **Quyền:** `admin`
- **Query:** `from`, `to` (không bắt buộc; mặc định 30 ngày gần nhất)

**200 OK**

```json
{
  "error": false,
  "data": {
    "from": "2026-08-27",
    "to": "2026-09-26",
    "users": {"total":512,"students":470,"teachers":32,"admins":10,"locked":4,"newInPeriod":63},
    "courses": {"total":28,"published":21,"draft":6,"archived":1},
    "enrollments": {"total":1840,"active":1712,"completed":268,"cancelled":60},
    "learning": {"activeLearners7d":384,"averageCompletionRate":0.39,"averageScore":6.9,"atRiskCount":87},
    "ai": {"jobsQueued":1,"jobsRunning":2,"jobsSucceeded24h":46,"jobsFailed24h":3,"lastPredictionAt":"2026-09-26T06:01:12Z"},
    "computedAt": "2026-09-26T10:30:00Z",
    "dataFreshnessSeconds": 900
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `403`, `400`.

#### `GET /api/admin/content-reports`
Danh sách báo cáo vi phạm nội dung.

- **Quyền:** `admin`
- **Query:** `page`, `take`, `status` (`pending,resolved,rejected`), `reason`, `reportedById`, `from`, `to`, `search`, `sortBy` (`createdAt`), `order`

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": {"id":"4d5e6f70-8192-4adb-8e3f-4a5b6c7d8e9f","targetType":"discussion_post","targetId":"c5d6e7f8-091a-42b3-8cc5-d6e7f8091a2b","reason":"spam","detail":"Nội dung quảng cáo ngoài lề.","status":"pending","reportedBy":{"id":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","fullName":"Nguyễn Văn A"},"resolvedBy":null,"resolvedAt":null,"resolutionNote":null,"createdAt":"2026-09-26T07:40:00Z","updatedAt":"2026-09-26T07:40:00Z"},
    "meta": {"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `403`, `400`.

#### `GET /api/admin/content-reports/:id`
Chi tiết báo cáo vi phạm (kèm nội dung bị báo cáo để đối chiếu).

- **Quyền:** `admin`

**200 OK** — object báo cáo + `target: { type, id, excerpt, authorId, isHidden }`.

**Lỗi thường gặp:** `404`, `403`.

#### `PATCH /api/admin/content-reports/:id`
Duyệt hoặc từ chối báo cáo vi phạm.

- **Quyền:** `admin`

```json
{"status":"resolved","resolutionNote":"Đã ẩn bài viết và nhắc nhở người đăng.","hideTarget":true}
```

**200 OK** — `{ "error": false, "data": { "id": "...", "status": "resolved", "resolvedBy": "...", "resolvedAt": "2026-09-26T11:00:00.000Z", "resolutionNote": "Đã ẩn bài viết và nhắc nhở người đăng.", "updatedAt": "..." }, "message": "Đã xử lý báo cáo" }`

**Lỗi thường gặp:** `400` (`status` ngoài `resolved|rejected`), `404`, `409` (báo cáo đã xử lý).

#### `GET /api/admin/alert-settings`
Xem cấu hình cảnh báo sớm toàn hệ thống (ngưỡng rủi ro, tần suất chạy, kênh gửi).

- **Quyền:** `admin`

**200 OK**

```json
{
  "error": false,
  "data": {"id":"5e6f7081-92a3-4bdc-8f4a-5b6c7d8e9f01","riskThresholdMedium":0.4,"riskThresholdHigh":0.7,"pipelineCronExpression":"0 6 * * *","pipelineTimezone":"Asia/Ho_Chi_Minh","enableAutoPrediction":true,"notifyLearnerOnHighRisk":true,"notifyTeacherOnHighRisk":true,"channels":["in_app"],"quietHours":{"enabled":false,"from":"22:00","to":"06:00"},"updatedBy":{"id":"9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d","fullName":"Quản trị viên"},"createdAt":"2026-09-20T02:00:00Z","updatedAt":"2026-09-25T05:00:00Z"},
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `403`.

#### `PATCH /api/admin/alert-settings`
Cập nhật cấu hình cảnh báo sớm (mọi thay đổi ghi `audit_logs`).

- **Quyền:** `admin`

```json
{"riskThresholdMedium":0.35,"riskThresholdHigh":0.65,"pipelineCronExpression":"0 */6 * * *","enableAutoPrediction":true,"channels":["in_app","email"]}
```

**200 OK** — trả object cấu hình sau cập nhật.

**Lỗi thường gặp:** `400` (`riskThresholdMedium ≥ riskThresholdHigh`, cron không hợp lệ, `channels` chứa giá trị ngoài `'in_app' | 'email'`).

> Cấu hình này là **đầu vào** cho cron/queue ở mục 11 luồng (c); `alert_settings` do **NestJS** đọc và đẩy job — FastAPI **không** tự đọc bảng này (xem mục 8).

#### `GET /api/admin/audit-logs`
Xem log hành động quan trọng (ai làm gì, khi nào, trên đối tượng nào).

- **Quyền:** `admin`
- **Query:**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `page`, `take` | number | Phân trang |
| `actorId` | uuid | Lọc theo người thực hiện |
| `action` | string | Ví dụ `user.role_changed`, `course.published`, `alert_settings.updated`, `submission.feedback_updated`, `content_report.resolved` (đề xuất danh mục action) |
| `targetType` | string | `user` \| `course` \| `lesson` \| `quiz` \| `intervention` \| `alert_settings` \| `content_report` |
| `targetId` | uuid | Lọc theo đối tượng |
| `from`, `to` | date | Khoảng thời gian |
| `search` | string | Khớp `action`, `targetType` |
| `sortBy` | `createdAt` | Mặc định `createdAt` |
| `order` | `asc`\|`desc` | Mặc định `desc` |

```http
GET /api/admin/audit-logs?actorId=9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d&action=alert_settings.updated&from=2026-09-01&to=2026-09-26&page=1&take=50
```

**200 OK**

```json
{
  "error": false,
  "data": {
    "items": {"id":"6f708192-a3b4-4ced-8a5b-6c7d8e9f0123","actor":{"id":"9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d","fullName":"Quản trị viên","role":"admin"},"action":"alert_settings.updated","targetType":"alert_settings","targetId":"5e6f7081-92a3-4bdc-8f4a-5b6c7d8e9f01","changes":{"riskThresholdHigh":{"from":0.7,"to":0.65}},"ipAddress":"203.0.113.10","userAgent":"Mozilla/5.0 ...","requestId":"b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e","createdAt":"2026-09-25T05:00:00Z","updatedAt":"2026-09-25T05:00:00Z"},
    "meta": {"page":1,"take":50,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}
  },
  "message": "Thành công"
}
```

**Lỗi thường gặp:** `403`, `400`. `changes` **có thể chứa dữ liệu nhạy cảm** — không ghi mật khẩu/token vào `changes` (bắt buộc).

> Log job AI của admin dùng **`GET /api/ai/jobs`** (mục AIGatewayModule) — **không** tạo thêm `/api/admin/ai-jobs` để tránh hai endpoint trùng chức năng.

### HealthModule (`/api/health`)

#### `GET /api/health`
Kiểm tra service còn sống và kết nối database (**giữ nguyên như hiện có**).

- **Quyền:** công khai

**200 OK**

```json
{"error":false,"data":{"status":"ok","uptimeSeconds":12.3,"timestamp":"2026-09-26T10:40:00Z","database":"up"},"message":"Thành công"}
```

`database: "down"` nghĩa là tiến trình API còn sống nhưng kết nối Postgres thất bại (kiểm tra `DB_*` trong `backend/.env`).

**Lỗi thường gặp:** không có — endpoint luôn trả `200`; trạng thái DB phản ánh trong `data.database`.

> **Đề xuất** bổ sung (không thay đổi endpoint hiện có): `GET /api/health/ready` (readiness: DB + Redis + kết nối FastAPI nội bộ) và `GET /api/health/live` (liveness thuần). Hiện **chưa có** trong code.

---

## 8. Hợp đồng tích hợp NestJS ↔ FastAPI

### 8.1 Nguyên tắc

1. **FastAPI không expose ra internet.** Chỉ NestJS (hoặc worker) gọi được, qua network nội bộ/VPC (`docs/architecture.md` mục 8). Không có route FastAPI nào đi qua Cloudflare tunnel của `deploy/`.
2. **NestJS không block** cho job nặng: `AIGatewayModule` đẩy job vào BullMQ (Redis) và trả `202` ngay. Job nhẹ (healthcheck, predict 1 học viên với rule-based nhanh) **có thể** gọi REST nội bộ đồng bộ **với timeout ngắn** (đề xuất **3 giây**).
3. **Ai ghi gì — không tranh chấp dữ liệu (bắt buộc):**

| Dữ liệu | NestJS | FastAPI |
|---|---|---|
| `ai_jobs` | **Tạo** row khi nhận request (`queued`), cập nhật `running` khi worker nhận job, `attempts`, `queuedAt` | **Chỉ cập nhật** `status`, `progress`, `startedAt`, `finishedAt`, `errorMessage`, `modelVersion` của **đúng job id** được giao |
| `risk_predictions` | **Chỉ đọc** để phục vụ API (`/api/ai/learners/:id/risk`, `/api/analytics/.../at-risk`) | **Ghi** row kết quả (nguồn duy nhất ghi bảng này) |
| `learning_events` | **Ghi** (từ API batch) | **Chỉ đọc** (tính feature) |
| `interventions`, `notifications` | **Ghi** (NestJS quyết định và gửi) | **Không** ghi; có thể gợi ý qua `recommendedActions` trong payload kết quả |
| `model_versions` | **Đọc** để trả `GET /api/ai/models` | **Ghi/đăng ký** khi có model mới (đề xuất) |

Quy tắc vàng: **mỗi bảng chỉ có một bên ghi**. Nếu FastAPI cần thêm field vào `ai_jobs`, thống nhất qua migration, không tự `ALTER`.

### 8.2 Xác thực service-to-service **(đề xuất)**

Chưa có cơ chế nào trong code. Đề xuất **API key tĩnh qua header** cho v1 (đơn giản, đủ cho mạng nội bộ), nâng lên JWT nội bộ khi cần:

| Header | Giá trị | Ghi chú |
|---|---|---|
| `X-Internal-Api-Key` | `AI_SERVICE_API_KEY` (biến môi trường, hai bên cùng giá trị) | Bắt buộc trên **mọi** request vào FastAPI |
| `X-Request-Id` | UUID | Truy vết xuyên service; NestJS sinh, FastAPI echo lại |
| `X-Caller-Service` | `uniprep-api` | Phòng khi có nhiều caller |

- FastAPI **từ chối** request thiếu/sai key → `401` (message tiếng Việt hoặc tiếng Anh đều được ở tầng nội bộ, nhưng **không** trả chi tiết).
- Key **không** xuất hiện trong response, log công khai, hay Git (chỉ trong `.env`).
- **Đề xuất nâng cấp:** JWT nội bộ (`iss = uniprep-api`, `aud = uniprep-ai`, TTL 5 phút, ký HS256 bằng secret riêng) khi triển khai nhiều instance.

### 8.3 BullMQ — hàng đợi, job type và payload

| Hạng mục | Giá trị (đề xuất nếu chưa có trong tài liệu kiến trúc) |
|---|---|
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` |
| Tên queue | `ai-risk` (mọi job AI/rủi ro) |
| Retry | `attempts: 3`, backoff exponential `delay: 2000` ms |
| Giữ job | `removeOnComplete: { age: 86400, count: 1000 }`, `removeOnFail: { age: 604800 }` |
| Concurrency | Worker FastAPI: `1`–`4` tuỳ CPU/GPU (cấu hình phía FastAPI) |
| Timeout job | `300` giây cho `risk.predict.batch`, `60` giây cho `risk.predict.single` |

**Job type và payload:**

`risk.predict.single` — payload:

```json
{
  "jobId": "d6e7f809-1a2b-43c4-8dd6-e7f8091a2b3c",
  "jobType": "risk.predict.single",
  "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
  "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
  "modelVersion": "rule-based-v1",
  "requestedBy": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "createdAt": "2026-09-26T10:10:00Z",
  "callbackUrl": null,
  "options": {"includeHistory":false}
}
```

Kết quả job (`returnvalue` của BullMQ, worker FastAPI trả về **sau khi** đã ghi `risk_predictions`):

```json
{
  "jobId": "d6e7f809-1a2b-43c4-8dd6-e7f8091a2b3c",
  "status": "succeeded",
  "predictionId": "e7f8091a-2b3c-44d5-8ee7-f8091a2b3c4d",
  "riskScore": 0.78,
  "riskLevel": "high",
  "modelVersion": "rule-based-v1",
  "computedAt": "2026-09-26T10:10:07Z",
  "durationMs": 4820
}
```

`risk.predict.batch` — payload (chạy theo cron hoặc theo khoá học):

```json
{
  "jobId": "d6e7f809-1a2b-43c4-8dd6-e7f8091a2b3d",
  "jobType": "risk.predict.batch",
  "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
  "userIds": null,
  "scope": "course",
  "modelVersion": "rule-based-v1",
  "requestedBy": null,
  "createdAt": "2026-09-26T06:00:00Z",
  "options": {"overwriteExisting":true}
}
```

- `scope`: `'learner' | 'course' | 'all'`; khi `scope = 'course'`, `courseId` bắt buộc; khi `scope = 'learner'`, `userIds` bắt buộc.
- Kết quả:

```json
{
  "jobId": "d6e7f809-1a2b-43c4-8dd6-e7f8091a2b3d",
  "status": "succeeded",
  "processed": 148,
  "succeeded": 145,
  "failed": 3,
  "highRiskCount": 12,
  "mediumRiskCount": 26,
  "failedLearnerIds": "...uuid...",
  "modelVersion": "rule-based-v1",
  "computedAt": "2026-09-26T06:01:12Z",
  "durationMs": 72000
}
```

`ai.healthcheck` — payload `{ "jobId": "...", "jobType": "ai.healthcheck", "createdAt": "..." }`; kết quả `{ "status": "succeeded", "modelLoaded": true, "modelVersions": ["rule-based-v1"], "checkedAt": "..." }`. Dùng để kiểm tra worker FastAPI còn sống mà không cần expose HTTP.

### 8.4 Endpoint nội bộ của FastAPI **(đề xuất — chưa tồn tại)**

Base URL nội bộ: `AI_SERVICE_URL` (ví dụ `http://ai-service:8000`). **Không** có route nào public.

#### `POST /internal/risk/predict`
Dự đoán rủi ro đồng bộ cho **một** học viên (job nhẹ) — NestJS gọi khi cần kết quả ngay.

Request:

```json
{
  "requestId": "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
  "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
  "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
  "modelVersion": "rule-based-v1",
  "persist": true,
  "features": null
}
```

- `features: null` → FastAPI tự đọc dữ liệu từ PostgreSQL (quyền **chỉ đọc**, `docs/architecture.md` mục 3.3). Nếu NestJS gửi sẵn `features`, FastAPI dùng luôn (đề xuất cho test).
- FastAPI ghi `risk_predictions` nếu `persist: true`, và cập nhật `ai_jobs` nếu `jobId` được gửi kèm.

Response `200`:

```json
{
  "requestId": "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
  "predictionId": "e7f8091a-2b3c-44d5-8ee7-f8091a2b3c4d",
  "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
  "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
  "riskScore": 0.78,
  "riskLevel": "high",
  "contributingFactors": {"feature":"days_since_last_activity","value":9,"weight":0.31,"direction":"increases_risk"},
  "modelVersion": "rule-based-v1",
  "computedAt": "2026-09-26T10:10:07Z",
  "durationMs": 120
}
```

Lỗi: `400` (thiếu `userId`), `401` (sai API key), `404` (không tìm thấy học viên), `422` (không đủ dữ liệu feature), `500`.

#### `GET /internal/health`
Kiểm tra sức khoẻ service AI (dùng cho `GET /api/health/ready` — đề xuất).

Response `200`:

```json
{"status":"ok","uptimeSeconds":43210.5,"modelLoaded":true,"modelVersions":["rule-based-v1"],"database":"up","queue":"up","timestamp":"2026-09-26T10:40:00Z"}
```

#### `POST /internal/jobs/:jobId/ack` **(đề xuất, tuỳ chọn)**
FastAPI báo NestJS rằng job đã xong (thay vì chỉ dựa vào BullMQ events), để NestJS phát WebSocket `ai.job.updated`. Có thể **bỏ** nếu NestJS lắng nghe sự kiện BullMQ trực tiếp (khuyến nghị cách sau — đơn giản hơn).

### 8.5 Luồng dữ liệu đầy đủ

```text
FE ──POST /api/ai/risk/predict──▶ NestJS (AIGatewayModule)
                                   │ 1. tạo row ai_jobs (status=queued)
                                   │ 2. queue.add('risk.predict.single', payload)
                                   │ 3. trả 202 { jobId, status: queued }
FE ◀───────────────────────────────┘
                                   │
                        Redis/BullMQ (queue: ai-risk)
                                   ▼
                          FastAPI worker
                           │ a. cập nhật ai_jobs → running (progress)
                           │ b. đọc learning_events / enrollments / submissions (read-only)
                           │ c. tính feature + chạy model + SHAP/rule explain
                           │ d. INSERT risk_predictions (nguồn ghi duy nhất)
                           │ e. cập nhật ai_jobs → succeeded/failed + resultRef
                           ▼
NestJS (lắng nghe BullMQ event 'completed'/'failed')
   │ f. phát WebSocket ai.job.updated
   │ g. nếu risk_level = 'high' → tạo notifications + risk.alert.created
   ▼
FE (polling GET /api/ai/jobs/:id   HOẶC   nhận WebSocket)
   └──GET /api/ai/learners/:id/risk──▶ NestJS đọc risk_predictions → trả kết quả
```

---

## 9. WebSocket (tuỳ chọn)

Theo `docs/proposal.md` mục 5.1 ("Realtime (Optional): Socket.IO client") và `docs/architecture.md` mục 3.1, realtime là **tuỳ chọn**. Nếu bật:

| Hạng mục | Giá trị |
|---|---|
| Thư viện | Socket.IO (server: `@nestjs/websockets` + `@nestjs/platform-socket.io` trên NestJS) |
| Namespace | `/realtime` |
| URL | `ws://localhost:3000/realtime` (dev), `wss://<host>/realtime` (prod) |
| Phòng (rooms) | `user:<userId>` (mọi client tự join), `course:<courseId>` (teacher/admin của khoá join) |
| Transport | WebSocket, fallback polling (mặc định Socket.IO) |

**Xác thực khi handshake:** access token gửi qua `auth` payload (khuyến nghị, không lộ token trong URL/log):

```ts
io('http://localhost:3000/realtime', { auth: { token: accessToken } })
```

- Server verify JWT trong `handleConnection`; **sai/hết hạn → ngắt kết nối ngay** với `error: { code: 'UNAUTHENTICATED', message: 'Bạn chưa đăng nhập hoặc phiên đã hết hạn.' }`.
- Token hết hạn giữa phiên: server phát `auth.expired` và ngắt; client gọi `/api/auth/refresh` rồi kết nối lại (đề xuất).
- **Không** nhận token qua query string `?token=` (dễ lộ trong log/proxy) — nếu buộc phải dùng, chỉ cho phép ở dev.

**Sự kiện server → client:**

| Sự kiện | Room | Khi nào |
|---|---|---|
| `risk.alert.created` | `user:<userId>` và `course:<courseId>` | Sau khi có `risk_predictions` mới với `riskLevel = 'medium'|'high'` và ngưỡng `alert_settings` cho phép |
| `notification.created` | `user:<userId>` | Khi tạo row `notifications` mới |
| `ai.job.updated` | `user:<requestedBy>` (hoặc room `admin` cho admin) | Khi `ai_jobs.status` đổi (`queued` → `running` → `succeeded`/`failed`) |

Payload `risk.alert.created`:

```json
{
  "eventId": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f708192a3",
  "occurredAt": "2026-09-26T06:00:05Z",
  "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
  "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
  "riskScore": 0.78,
  "riskLevel": "high",
  "summary": "Học viên chưa vào học 9 ngày và hoàn thành 35% lộ trình.",
  "contributingFactors": [{"feature":"days_since_last_activity","label":"Số ngày kể từ lần học gần nhất","value":9,"weight":0.31},{"feature":"completion_rate_vs_expected","label":"Tỷ lệ hoàn thành so với lộ trình","value":0.35,"weight":0.27}],
  "modelVersion": "rule-based-v1",
  "notificationId": "3c4d5e6f-7081-49ca-9d2e-3f4a5b6c7d8e"
}
```

Payload `notification.created`:

```json
{
  "id": "3c4d5e6f-7081-49ca-9d2e-3f4a5b6c7d8e",
  "type": "risk_alert",
  "title": "Cảnh báo tiến độ học tập",
  "body": "Bạn chưa vào học 9 ngày. Hãy ôn lại Chương 2 để theo kịp lộ trình.",
  "isRead": false,
  "payload": {"courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","riskLevel":"high"},
  "createdAt": "2026-09-26T06:00:05Z"
}
```

Payload `ai.job.updated`:

```json
{
  "jobId": "d6e7f809-1a2b-43c4-8dd6-e7f8091a2b3c",
  "jobType": "risk.predict.single",
  "status": "succeeded",
  "progress": 100,
  "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601",
  "resultRef": {"predictionId":"e7f8091a-2b3c-44d5-8ee7-f8091a2b3c4d","riskLevel":"high","riskScore":0.78},
  "errorMessage": null,
  "updatedAt": "2026-09-26T10:10:07Z"
}
```

**Sự kiện client → server:** chỉ có `subscribe` / `unsubscribe` (đề xuất):

```json
{"room":"course:b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f"}
```

Server **kiểm tra quyền** trước khi cho join room `course:*` (phải là teacher được gán hoặc admin). `user:*` chỉ được join room của chính mình.

> **Bắt buộc:** WebSocket **không thay thế** REST. Mọi dữ liệu nhận qua socket phải lấy lại được bằng REST (polling là fallback chính thức) — vì realtime là tuỳ chọn (`docs/proposal.md` mục 5.1).

---

## 10. Idempotency & chống lạm dụng

### 10.1 Rate limit **(đề xuất — chưa có trong code; một phần đã làm ở E1)**

Chưa có `ThrottlerModule`/Redis rate limit trong repo. Đề xuất dùng `@nestjs/throttler` với storage Redis (dùng chung Redis của BullMQ, DB khác).

> **Đã làm ở E1 (2026-10-03) — chỉ phần theo tài khoản:** ngưỡng "10 lần/15 phút/tài khoản" của
> `POST /api/auth/login` được hiện thực bằng `users.failed_login_count` + `users.locked_until`
> (E1-T5). Vượt ngưỡng ⇒ **`403`** kèm message nêu rõ số phút, **không phải `429`** — vì đây là khoá
> tài khoản (trạng thái nghiệp vụ), không phải chặn theo tần suất. Toàn bộ rate limit **theo IP**
> (bao gồm việc trả `429` + `Retry-After`) được **hoãn sang E13-T4** theo chốt của nhóm, vì cần bộ
> đếm dùng chung (Redis) mà E1 chưa có; khi làm E13-T4 thì phần theo tài khoản ở trên vẫn giữ.

| Endpoint | Hạn mức đề xuất | Khóa đếm | Ghi chú |
|---|---|---|---|
| `POST /api/auth/login` | 5 lần/phút/IP **và** 10 lần/15 phút/tài khoản | IP + email | Vượt → `429` + `Retry-After`; **phần theo tài khoản đã có ở E1 (trả `403`, khoá 15 phút)** |
| `POST /api/auth/refresh` | 30 lần/giờ/IP | IP | Rotation làm token cũ vô hiệu |
| `POST /api/auth/forgot-password` | 3 lần/giờ/email **và** 10 lần/giờ/IP | email + IP | Chống spam email |
| `POST /api/auth/reset-password` | 10 lần/giờ/IP | IP | |
| `POST /api/auth/register` | 5 lần/giờ/IP | IP | |
| `POST /api/learning-events` | 1 req/giây/user, burst 5 | `userId` | Đủ cho telemetry theo lô 50 sự kiện |
| `POST /api/ai/risk/predict` | 10 lần/giờ/user | `userId` | Job nặng |
| `POST /api/quizzes/:id/attempts` | 10 lần/giờ/user | `userId` | Kèm ràng buộc `maxAttempts` |
| Các `GET` danh sách/analytics | 120 lần/phút/user | `userId` | Analytics nặng hơn → 60 lần/phút |
| Mặc định toàn hệ thống | 300 lần/phút/IP | IP | Lưới an toàn |

- Vượt hạn mức → `429` với message **đúng nguyên văn** `fallbackMessages[429]`: `"Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút."`
- Response `429` kèm header `Retry-After` (giây) **(đề xuất)**.

### 10.2 Chống trùng lặp khi client retry

| Cơ chế | Áp dụng cho | Quy tắc |
|---|---|---|
| `clientEventId` trong mỗi sự kiện | `POST /api/learning-events` | Unique index `(userId, clientEventId)`; bản ghi trùng bị bỏ qua và đếm vào `duplicated` |
| Idempotent theo nghiệp vụ | `POST /api/lessons/:id/complete`, `PATCH /api/notifications/:id/read`, `POST /api/enrollments` | Gọi lại không tạo bản ghi mới; `enrollments` trả `409` (hoặc `200` với bản ghi cũ — nhóm chốt ở mục 13, câu hỏi 4) |
| `Idempotency-Key` **(đề xuất)** | Các `POST` tạo tài nguyên: `/api/enrollments`, `/api/submissions`, `/api/interventions`, `/api/ai/risk/predict` | Client gửi UUID trong header `Idempotency-Key`; server lưu `(key, userId, endpoint, responseHash)` TTL **24 giờ**; request lặp với cùng key → trả lại **nguyên response cũ** (cùng status) thay vì tạo bản ghi thứ hai |
| Unique constraint ở DB | `users.email`, `courses.code`, `categories.slug`, `enrollments (userId, courseId)`, `lesson_progress (enrollmentId, lessonId)`, `risk_predictions (userId, courseId, computedAt)` | Nguồn chân lý cuối cùng; vi phạm → `409` |
| Chống ghi đè quiz khi đang làm | `POST /api/submissions` | `submissions (attemptId)` unique — nộp hai lần cùng lượt → `409` |

Khi trả lại response cũ theo `Idempotency-Key`, server thêm header **(đề xuất)** `Idempotency-Replayed: true` để FE phân biệt.

---

## 11. Ví dụ luồng end-to-end

> **Cập nhật E3 (2026-10-03) — đọc kèm cảnh báo này:** các luồng dưới đây được soạn **trước E3** và
> **cố ý không** được viết lại toàn bộ (chúng minh hoạ luồng nghiệp vụ, không phải hợp đồng từng
> field). Những chỗ **đã lệch** so với mã nguồn E3, tra §7 để lấy hình dạng đúng:
> - khoá học dùng `title` (không phải `name`), `owner` (không phải `teacher`);
> - `GET /api/courses` nhận `ownerId`, không nhận `teacherId`;
> - bài học **không** có `type`/`videoUrl`/`durationSeconds`/`myProgress` — thay bằng `derivedType`,
>   `content`/`contentFormat`, `materials[]` (tiến độ theo bài học đã có ở E4);
> - message của `POST /api/enrollments` là `"Đăng ký khoá học thành công"` (không phải `"Ghi danh
>   thành công"`), `data` là `MyEnrollmentSummary`;
> - các bước quiz/bài nộp đã có code E5; các bước cảnh báo rủi ro vẫn là **đặc tả đích** (chưa có code).

### (a) Học viên: đăng ký → ghi danh → xem bài học → nộp quiz → nhận cảnh báo rủi ro

**1. Đăng ký**

```http
POST /api/auth/register
Content-Type: application/json

{ "email": "sv2026001@hcmut.edu.vn", "password": "Abcd@1234", "fullName": "Nguyễn Văn A", "studentCode": "SV2026001" }
```

```json
{
  "error": false,
  "data": {"accessToken":"eyJ...","refreshToken":"b0f5...","tokenType":"Bearer","expiresIn":900,"user":{"id":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","role":"student","status":"active"}},
  "message": "Đăng ký thành công"
}
```

**2. Telemetry `login` (theo lô)**

```http
POST /api/learning-events
Authorization: Bearer eyJ...
Content-Type: application/json

{ "events": [ { "clientEventId": "1f7c9a10-3b2e-4d51-9c8a-7e6f5d4c3b2a", "eventType": "login", "occurredAt": "2026-09-22T04:00:00.000Z", "metadata": { "device": "desktop" } } ] }
```

```json
{"error":false,"data":{"accepted":1,"rejected":0,"duplicated":0,"receivedAt":"2026-09-22T04:00:00.12Z"},"message":"Đã ghi nhận sự kiện"}
```

**3. Tìm khoá học và ghi danh**

```http
GET /api/courses?search=nhap%20mon&status=published&page=1&take=20
Authorization: Bearer eyJ...
```

```json
{
  "error": false,
  "data": {"items":[{"id":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","code":"CS101","name":"Nhập môn lập trình","status":"published"}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

```http
POST /api/enrollments
Authorization: Bearer eyJ...

{ "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f" }
```

```json
{"error":false,"data":{"id":"d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70","status":"active","progressPercent":0,"enrolledAt":"2026-09-22T04:00:05Z"},"message":"Ghi danh thành công"}
```

**4. Xem bài học và đánh dấu hoàn thành**

```http
GET /api/lessons/f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192
Authorization: Bearer eyJ...
```

```json
{"error":false,"data":{"id":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","title":"Bài 1 — Tổng quan môn học","type":"video","myProgress":{"state":"in_progress","completedAt":null}},"message":"Thành công"}
```

```http
POST /api/lessons/f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192/complete
Authorization: Bearer eyJ...

{ "timeSpentSeconds": 840 }
```

```json
{"error":false,"data":{"lessonId":"f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192","state":"completed","progressPercent":3.1},"message":"Đã đánh dấu hoàn thành bài học"}
```

**5. Làm quiz: bắt đầu lượt → nộp bài (chấm tự động)**

```http
POST /api/quizzes/5e6f7081-92a3-4b4c-8d5e-6f708192a3b4/attempts
Authorization: Bearer eyJ...
```

```json
{
  "error": false,
  "data": {"id":"92a3b4c5-d6e7-4f80-9a92-a3b4c5d6e7f8","attemptNo":1,"status":"in_progress","expiresAt":"2026-09-25T09:30:00Z","questions":[{"id":"6f708192-a3b4-4c5d-8e6f-708192a3b4c5","content":"Kiểu dữ liệu nào lưu số nguyên trong C++?","type":"single_choice","options":[{"id":"708192a3-b4c5-4d6e-8f70-8192a3b4c5d6","content":"int"}]}]},
  "message": "Bắt đầu làm bài thành công"
}
```

```http
POST /api/submissions
Authorization: Bearer eyJ...

{ "attemptId": "92a3b4c5-d6e7-4f80-9a92-a3b4c5d6e7f8", "answers": [ { "questionId": "6f708192-a3b4-4c5d-8e6f-708192a3b4c5", "selectedOptionIds": ["708192a3-b4c5-4d6e-8f70-8192a3b4c5d6"] } ] }
```

```json
{
  "error": false,
  "data": {"id":"a3b4c5d6-e7f8-4091-8aa3-b4c5d6e7f809","status":"graded","score":8.5,"maxScore":10,"correctCount":17,"totalQuestions":20,"passed":true,"autoGraded":true},
  "message": "Nộp bài thành công. Điểm của bạn: 8.5/10"
}
```

**6. Xem lại lỗi**

```http
GET /api/submissions/a3b4c5d6-e7f8-4091-8aa3-b4c5d6e7f809/review
Authorization: Bearer eyJ...
```

```json
{
  "error": false,
  "data": {"submissionId":"a3b4c5d6-e7f8-4091-8aa3-b4c5d6e7f809","score":8.5,"items":[{"questionId":"6f708192-a3b4-4c5d-8e6f-708192a3b4c5","isCorrect":true,"earnedPoints":0.5,"correctOptionIds":["708192a3-b4c5-4d6e-8f70-8192a3b4c5d6"],"explanation":"int lưu số nguyên; float lưu số thực."}]},
  "message": "Thành công"
}
```

**7. Nhận cảnh báo rủi ro** — sau khi pipeline chạy (mục c), học viên gọi:

```http
GET /api/notifications?isRead=false
Authorization: Bearer eyJ...
```

```json
{
  "error": false,
  "data": {"items":[{"id":"3c4d5e6f-7081-49ca-9d2e-3f4a5b6c7d8e","type":"risk_alert","title":"Cảnh báo tiến độ học tập","body":"Bạn chưa vào học 9 ngày. Hãy ôn lại Chương 2 để theo kịp lộ trình.","isRead":false,"payload":{"riskLevel":"high","courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f"}}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false},"unreadCount":1},
  "message": "Thành công"
}
```

Song song đó, nếu bật WebSocket, client đã nhận `risk.alert.created` (payload ở mục 9).

### (b) Giảng viên: xem dashboard lớp → thấy học viên at-risk kèm lý do → gửi can thiệp

**1. Đăng nhập và lấy danh sách khoá mình phụ trách**

```http
POST /api/auth/login
{ "email": "gv001@hcmut.edu.vn", "password": "Abcd@1234" }
```

```http
GET /api/courses?teacherId=1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d&page=1&take=20
Authorization: Bearer eyJ...
```

```json
{
  "error": false,
  "data": {"items":[{"id":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","code":"CS101","name":"Nhập môn lập trình","enrolledCount":148}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

**2. Xem tổng quan khoá học**

```http
GET /api/analytics/courses/b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f/overview
Authorization: Bearer eyJ...
```

```json
{
  "error": false,
  "data": {"courseId":"b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f","enrolledCount":148,"completionRate":0.42,"averageScore":7.1,"atRiskCount":12,"riskDistribution":{"low":110,"medium":26,"high":12},"computedAt":"2026-09-26T08:00:00Z"},
  "message": "Thành công"
}
```

**3. Xem xu hướng 30 ngày**

```http
GET /api/analytics/courses/b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f/trends?from=2026-08-27&to=2026-09-26&granularity=week
Authorization: Bearer eyJ...
```

```json
{"error":false,"data":{"granularity":"week","points":[{"bucket":"2026-09-21","activeLearners":96,"lessonCompletions":341,"quizSubmissions":118,"averageScore":7.15}]},"message":"Thành công"}
```

**4. Danh sách học viên rủi ro kèm lý do (explainability)**

```http
GET /api/analytics/courses/b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f/at-risk?riskLevel=high&sortBy=riskScore&order=desc&page=1&take=20
Authorization: Bearer eyJ...
```

```json
{
  "error": false,
  "data": {"items":[{"userId":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","fullName":"Nguyễn Văn A","riskScore":0.78,"riskLevel":"high","contributingFactors":[{"feature":"days_since_last_activity","label":"Số ngày kể từ lần học gần nhất","value":9,"weight":0.31,"direction":"increases_risk"}],"modelVersion":"rule-based-v1","computedAt":"2026-09-26T06:00:00Z","progressPercent":35,"averageScore":5.4}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

**5. Xem dòng thời gian để hiểu bối cảnh**

```http
GET /api/analytics/learners/8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601/timeline?from=2026-09-01&to=2026-09-26
Authorization: Bearer eyJ...
```

```json
{
  "error": false,
  "data": {"userId":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","summary":{"activeDays":6,"lessonsCompleted":4,"quizSubmissions":1,"averageScore":5.4,"daysSinceLastActivity":9},"items":[{"occurredAt":"2026-09-17T10:00:00Z","eventType":"lesson_completed","lessonId":"a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d"}]},
  "message": "Thành công"
}
```

**6. Gửi can thiệp**

```http
POST /api/interventions
Authorization: Bearer eyJ...

{ "userId": "8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601", "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f", "predictionId": "e7f8091a-2b3c-44d5-8ee7-f8091a2b3c4d", "type": "message", "channel": "in_app", "title": "Nhắc xem lại Chương 2", "message": "Em chú ý hoàn thành Chương 2 trong tuần này nhé.", "recommendedLessonIds": ["a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d"], "dueDate": "2026-10-03" }
```

```json
{"error":false,"data":{"id":"091a2b3c-4d5e-46f7-8009-1a2b3c4d5e6f","status":"sent","sentAt":"2026-09-26T10:20:00Z"},"message":"Đã gửi can thiệp tới học viên"}
```

**7. Học viên nhận thông báo và xác nhận** — học viên gọi `GET /api/notifications?isRead=false` (như luồng (a) bước 7), sau đó:

```http
PATCH /api/interventions/091a2b3c-4d5e-46f7-8009-1a2b3c4d5e6f
Authorization: Bearer eyJ...

{ "status": "acknowledged", "note": "Em sẽ hoàn thành trong tuần này." }
```

```json
{"error":false,"data":{"id":"091a2b3c-4d5e-46f7-8009-1a2b3c4d5e6f","status":"acknowledged","acknowledgedAt":"2026-09-26T12:00:00Z"},"message":"Đã cập nhật trạng thái can thiệp"}
```

**8. Giảng viên theo dõi hiệu quả** — lọc lại danh sách rủi ro sau vài ngày, và xem lịch sử can thiệp:

```http
GET /api/interventions?courseId=b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f&status=acknowledged&page=1&take=20
Authorization: Bearer eyJ...
```

```json
{
  "error": false,
  "data": {"items":[{"id":"091a2b3c-4d5e-46f7-8009-1a2b3c4d5e6f","learner":{"id":"8f2a1b3c-4d5e-4f60-8a91-b2c3d4e5f601","fullName":"Nguyễn Văn A"},"type":"message","status":"acknowledged","dueDate":"2026-10-03"}],"meta":{"page":1,"take":20,"itemCount":1,"pageCount":1,"hasPreviousPage":false,"hasNextPage":false}},
  "message": "Thành công"
}
```

### (c) Cron/queue: chạy pipeline dự đoán rủi ro và ghi kết quả

**1. Cron trong NestJS** (`@nestjs/schedule`, đề xuất) đọc `alert_settings.pipelineCronExpression` (ví dụ `0 6 * * *`, timezone `Asia/Ho_Chi_Minh`) và **không** gọi FastAPI trực tiếp — chỉ đẩy job:

```ts
// AIGatewayService (mô tả, không phải code đã có)
// 1. đọc alert_settings → enableAutoPrediction, pipelineCronExpression
// 2. tạo row ai_jobs (status = 'queued', jobType = 'risk.predict.batch', requestedBy = null)
// 3. queue.add('risk.predict.batch', payload, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })
```

**2. Row `ai_jobs` được tạo (NestJS ghi):**

```json
{
  "jobId": "d6e7f809-1a2b-43c4-8dd6-e7f8091a2b3d",
  "jobType": "risk.predict.batch",
  "status": "queued",
  "courseId": "b7c1e2d3-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
  "scope": "course",
  "requestedBy": null,
  "queuedAt": "2026-09-26T06:00:00Z"
}
```

**3. Worker FastAPI nhận job** → cập nhật `ai_jobs` sang `running`, rồi:
- đọc `learning_events` (30 ngày gần nhất), `enrollments`, `lessons`, `submissions` → tính feature: `days_since_last_activity`, `completion_rate_vs_expected`, `score_trend`, `attempt_no_max`, `duration_anomaly`;
- chạy model (`rule-based-v1`), sinh `contributingFactors` cho từng học viên;
- **INSERT** `risk_predictions` (một row/học viên/khoá/lần chạy);
- cập nhật `ai_jobs` → `succeeded` + `resultRef`.

**4. NestJS lắng nghe sự kiện BullMQ `completed`** → phát WebSocket `ai.job.updated`, và với mỗi learner có `riskLevel = 'high'` (theo `alert_settings.riskThresholdHigh = 0.7`) → tạo `notifications` (kênh theo `alert_settings.channels`) + phát `risk.alert.created`.

**5. Kiểm tra kết quả qua API:**

```http
GET /api/ai/jobs/d6e7f809-1a2b-43c4-8dd6-e7f8091a2b3d
Authorization: Bearer <token admin>
```

```json
{
  "error": false,
  "data": {"jobId":"d6e7f809-1a2b-43c4-8dd6-e7f8091a2b3d","jobType":"risk.predict.batch","status":"succeeded","progress":100,"finishedAt":"2026-09-26T06:01:12Z","resultRef":{"processed":148,"highRiskCount":12,"modelVersion":"rule-based-v1"},"errorMessage":null},
  "message": "Thành công"
}
```

```http
GET /api/admin/overview
Authorization: Bearer <token admin>
```

```json
{"error":false,"data":{"ai":{"jobsQueued":0,"jobsRunning":0,"jobsSucceeded24h":47,"jobsFailed24h":3,"lastPredictionAt":"2026-09-26T06:01:12Z"},"learning":{"atRiskCount":87}},"message":"Thành công"}
```

**6. Nếu job thất bại** (ví dụ không đủ dữ liệu feature): `ai_jobs.status = 'failed'`, `errorMessage = "Không đủ dữ liệu hành vi để dự đoán."`; sau 3 lần thử BullMQ chuyển job sang failed-state; admin xem qua `GET /api/ai/jobs?status=failed`. **Không** tạo notification rủi ro khi job failed (tránh cảnh báo sai).

---

## 12. Checklist cho FE

Luồng bắt buộc trong repo: **`apis/<feature>` → `types/<feature>` → `pages/<feature>`** (`UniPrep/README.md`, mục *Frontend conventions*; tham chiếu `pages/student/index.tsx`). `apis/<feature>/index.ts` gọi `queryMethod` (`frontend/src/config/query-method/axiosMethod.config.ts`) và **nhận trực tiếp envelope** (interceptor đã bóc `response.data`).

Quy ước đặt tên: hàm `getX` / `getXById` / `createX` / `updateX` / `deleteX` (đúng như `apis/auth/index.ts`, module tham chiếu sau khi `apis/student` bị xoá ở E0), mỗi hàm trả `Promise<DefaultResponseType<T>>`.

| Endpoint | Hàm FE | File | Type |
|---|---|---|---|
| `POST /api/auth/register` | `register` | `apis/auth/index.ts` | `types/auth.ts` → `RegisterPayload`, `AuthResponse` |
| `POST /api/auth/login` | `login` | `apis/auth/index.ts` | `LoginPayload`, `AuthResponse` |
| `POST /api/auth/refresh` | `refreshToken` | `apis/auth/index.ts` | `RefreshPayload`, `TokenPair` |
| `POST /api/auth/logout` | `logout` | `apis/auth/index.ts` | `LogoutPayload` |
| `POST /api/auth/forgot-password` | `forgotPassword` | `apis/auth/index.ts` | `ForgotPasswordPayload` |
| `POST /api/auth/reset-password` | `resetPassword` | `apis/auth/index.ts` | `ResetPasswordPayload` |
| `POST /api/auth/change-password` | `changePassword` | `apis/auth/index.ts` | `ChangePasswordPayload` |
| `GET /api/auth/me` | `getMe` | `apis/auth/index.ts` | `types/user.ts` → `User` |
| `GET /api/users/me` | `getMyProfile` | `apis/user/index.ts` | `types/user.ts` → `UserDetail` |
| `PATCH /api/users/me` | `updateMyProfile` | `apis/user/index.ts` | `UpdateMyProfilePayload` |
| `POST /api/users/me/avatar` | `uploadAvatar` | `apis/user/index.ts` | *(chưa làm — **không** thuộc E3; E3-T4 đã dùng cho học liệu. Chưa có endpoint này ở backend)* |
| `DELETE /api/users/me/avatar` | `deleteAvatar` | `apis/user/index.ts` | *(chưa làm — như trên)* |
| `GET /api/users` | `getUsers` | `apis/user/index.ts` | `UserListItem`, `PaginatedUsers` |
| `POST /api/users` | `createUser` | `apis/user/index.ts` | *(chưa làm — E2 bỏ qua)* |
| `GET /api/users/:id` | `getUserById` | `apis/user/index.ts` | `UserDetail` |
| `PATCH /api/users/:id` | `updateUser` | `apis/user/index.ts` | *(chưa làm — E2 bỏ qua; chỉ có `PATCH /:id/status` và `/:id/role`)* |
| `DELETE /api/users/:id` | `deleteUser` | `apis/user/index.ts` | *(chưa làm — E2 bỏ qua)* |
| `PATCH /api/users/:id/status` | `updateUserStatus` | `apis/user/index.ts` | `UpdateUserStatusPayload` |
| `PATCH /api/users/:id/role` | `updateUserRole` | `apis/user/index.ts` | `UpdateUserRolePayload` |
| `GET /api/categories` | `getCategories` | `apis/category/index.ts` | `types/course.ts` → `PaginatedCategories` |
| `POST /api/categories` | `createCategory` | `apis/category/index.ts` | `CreateCategoryPayload` |
| `GET /api/categories/:id` | `getCategoryById` | `apis/category/index.ts` | `Category` |
| `PATCH /api/categories/:id` | `updateCategory` | `apis/category/index.ts` | `UpdateCategoryPayload` |
| `DELETE /api/categories/:id` | `deleteCategory` | `apis/category/index.ts` | `{ success: boolean }` |
| `GET /api/courses` | `getCourses` | `apis/course/index.ts` | `types/course.ts` → `PaginatedCourses` (item: `CourseListItem`), `FindCoursesParams` |
| `POST /api/courses` | `createCourse` | `apis/course/index.ts` | `CreateCoursePayload` → `CourseDetail` |
| `GET /api/courses/:id` | `getCourseById` | `apis/course/index.ts` | `CourseDetail` |
| `PATCH /api/courses/:id` | `updateCourse` | `apis/course/index.ts` | `UpdateCoursePayload` |
| `DELETE /api/courses/:id` | `deleteCourse` | `apis/course/index.ts` | `{ success: boolean }` |
| `PATCH /api/courses/:id/publish` | `publishCourse` | `apis/course/index.ts` | `PublishCoursePayload` → `{ id, status, updatedAt }` |
| `PATCH /api/courses/:id/unpublish` | `unpublishCourse` | `apis/course/index.ts` | `{ id, status, updatedAt }` |
| `GET /api/courses/:id/instructors` | `getCourseInstructors` | `apis/course/index.ts` | `CourseInstructorList` |
| `POST /api/courses/:id/instructors` | `assignInstructor` | `apis/course/index.ts` | `AssignInstructorPayload` → `CourseInstructorItem` |
| `DELETE /api/courses/:id/instructors/:userId` | `removeInstructor` | `apis/course/index.ts` | `{ success: boolean }` |
| `GET /api/courses/:id/cohorts` | `getCohorts` | `apis/course/index.ts` | `CohortList` |
| `POST /api/courses/:id/cohorts` | `createCohort` | `apis/course/index.ts` | `CreateCohortPayload` → `CohortItem` |
| `PATCH /api/cohorts/:id` | `updateCohort` | `apis/course/index.ts` | `UpdateCohortPayload` → `CohortItem` |
| `DELETE /api/cohorts/:id` | `deleteCohort` | `apis/course/index.ts` | `{ success: boolean }` |
| `PUT /api/courses/:id/prerequisites` | `setCoursePrerequisites` | `apis/course/index.ts` | `SetPrerequisitesPayload` → `PrerequisiteList` |
| `GET /api/courses/:courseId/sections` | `getSections` | `apis/lesson/index.ts` | `types/lesson.ts` → `PaginatedSections` (item: `SectionListItem`) |
| `POST /api/courses/:courseId/sections` | `createSection` | `apis/lesson/index.ts` | `CreateSectionPayload` → `SectionListItem` |
| `GET /api/sections/:id` | `getSectionById` | `apis/lesson/index.ts` | `SectionDetail` |
| `PATCH /api/sections/:id` | `updateSection` | `apis/lesson/index.ts` | `UpdateSectionPayload` → `SectionListItem` |
| `DELETE /api/sections/:id` | `deleteSection` | `apis/lesson/index.ts` | `{ success: boolean }` *(API thật trả `{ id }` — xem cảnh báo dưới bảng)* |
| `PATCH /api/courses/:courseId/sections/reorder` | `reorderSections` | `apis/lesson/index.ts` | `ReorderPayload` → `{ updated: number }` |
| `GET /api/courses/:courseId/lessons` | `getLessons` | `apis/lesson/index.ts` | `PaginatedLessons` (item: `LessonListItem`), `FindLessonsParams` |
| `POST /api/sections/:sectionId/lessons` | `createLesson` | `apis/lesson/index.ts` | `CreateLessonPayload` → `LessonDetail` |
| `GET /api/lessons/:id` | `getLessonById` | `apis/lesson/index.ts` | `LessonDetail` |
| `PATCH /api/lessons/:id` | `updateLesson` | `apis/lesson/index.ts` | `UpdateLessonPayload` → `LessonDetail` |
| `DELETE /api/lessons/:id` | `deleteLesson` | `apis/lesson/index.ts` | `{ success: boolean }` *(API thật trả `{ id }` — xem cảnh báo dưới bảng)* |
| `PATCH /api/sections/:sectionId/lessons/reorder` | `reorderLessons` | `apis/lesson/index.ts` | `ReorderPayload` → `{ updated: number }` |
| `PATCH /api/lessons/:id/publish` | `publishLesson` | `apis/lesson/index.ts` | `{ id, isPublished, updatedAt }` (không có type riêng — khai inline) |
| `PATCH /api/lessons/:id/hide` | `hideLesson` | `apis/lesson/index.ts` | `{ id, isPublished, updatedAt }` |
| `POST /api/lessons/:id/materials` | `uploadMaterial` | `apis/material/index.ts` | `UploadMaterialPayload` → `MaterialItem` |
| `GET /api/lessons/:id/materials` | `getMaterials` | `apis/material/index.ts` | `PaginatedMaterials` |
| `DELETE /api/materials/:id` | `deleteMaterial` | `apis/material/index.ts` | `{ success: boolean }` *(API thật trả `{ id }` — xem cảnh báo dưới bảng)* |
| `POST /api/enrollments` | `enrollCourse` | `apis/enrollment/index.ts` | `types/enrollment.ts` → `CreateEnrollmentPayload`, `MyEnrollmentSummary` |
| `GET /api/enrollments` | `getMyEnrollments` | `apis/enrollment/index.ts` | `PaginatedEnrollments` |
| `GET /api/enrollments/:id` | `getEnrollmentById` | `apis/enrollment/index.ts` | `EnrollmentListItem` |
| `DELETE /api/enrollments/:id` | `cancelEnrollment` | `apis/enrollment/index.ts` | `{ id, status, updatedAt }` |
| `GET /api/enrollments/:id/progress` | `getEnrollmentProgress` | `apis/enrollment/index.ts` | `EnrollmentProgress` |
| `POST /api/lessons/:id/complete` | `completeLesson` | `apis/enrollment/index.ts` | `{ lessonId, enrollmentId, state, progressPercent }` |
| `DELETE /api/lessons/:id/complete` | `uncompleteLesson` | `apis/enrollment/index.ts` | `{ lessonId, enrollmentId, state, progressPercent }` |
| `GET /api/courses/:id/progress` | `getCourseProgress` | `apis/enrollment/index.ts` | `CourseProgressSummary` |
| `GET /api/quizzes` | `getQuizzes` | `apis/quiz/index.ts` | `types/quiz.ts` → `QuizListItem` |
| `POST /api/quizzes` | `createQuiz` | `apis/quiz/index.ts` | `CreateQuizPayload` |
| `GET /api/quizzes/:id` | `getQuizById` | `apis/quiz/index.ts` | `QuizDetail` |
| `PATCH /api/quizzes/:id` | `updateQuiz` | `apis/quiz/index.ts` | `UpdateQuizPayload` |
| `DELETE /api/quizzes/:id` | `deleteQuiz` | `apis/quiz/index.ts` | `SuccessResponse` |
| `PATCH /api/quizzes/:id/publish` | `publishQuiz` | `apis/quiz/index.ts` | `QuizStatusPatch` |
| `GET /api/quizzes/:id/questions` | `getQuestions` | `apis/quiz/index.ts` | `Question` |
| `POST /api/quizzes/:id/questions` | `createQuestion` | `apis/quiz/index.ts` | `CreateQuestionPayload` |
| `PATCH /api/questions/:id` | `updateQuestion` | `apis/quiz/index.ts` | `UpdateQuestionPayload` |
| `DELETE /api/questions/:id` | `deleteQuestion` | `apis/quiz/index.ts` | `SuccessResponse` |
| `POST /api/questions/:id/options` | `createOption` | `apis/quiz/index.ts` | `CreateOptionPayload` |
| `PATCH /api/options/:id` | `updateOption` | `apis/quiz/index.ts` | `UpdateOptionPayload` |
| `DELETE /api/options/:id` | `deleteOption` | `apis/quiz/index.ts` | `SuccessResponse` |
| `PATCH /api/quizzes/:id/questions/reorder` | `reorderQuestions` | `apis/quiz/index.ts` | `ReorderPayload` |
| `POST /api/quizzes/:id/attempts` | `startAttempt` | `apis/attempt/index.ts` | `types/attempt.ts` → `Attempt` |
| `GET /api/attempts/:id` | `getAttemptById` | `apis/attempt/index.ts` | `Attempt` |
| `GET /api/quizzes/:id/attempts` | `getAttempts` | `apis/attempt/index.ts` | `AttemptListItem` |
| `POST /api/submissions` | `submitQuiz` | `apis/submission/index.ts` | `types/submission.ts` → `Submission` |
| `GET /api/submissions` | `getSubmissions` | `apis/submission/index.ts` | `SubmissionListItem` |
| `GET /api/submissions/:id` | `getSubmissionById` | `apis/submission/index.ts` | `Submission` |
| `GET /api/submissions/:id/review` | `getSubmissionReview` | `apis/submission/index.ts` | `SubmissionReview` |
| `PATCH /api/submissions/:id/feedback` | `giveFeedback` | `apis/submission/index.ts` | `GiveFeedbackPayload` |
| `POST /api/learning-events` | `sendLearningEvents` | `apis/learning-event/index.ts` | `types/learning-event.ts` → `LearningEventBatchPayload` |
| `GET /api/learning-events` | `getLearningEvents` | `apis/learning-event/index.ts` | `LearningEvent` |
| `GET /api/discussion-threads` | `getThreads` | `apis/discussion/index.ts` | `types/discussion.ts` → `Thread` |
| `POST /api/discussion-threads` | `createThread` | `apis/discussion/index.ts` | `CreateThreadPayload` |
| `GET /api/discussion-threads/:id` | `getThreadById` | `apis/discussion/index.ts` | `ThreadDetail` |
| `PATCH /api/discussion-threads/:id` | `updateThread` | `apis/discussion/index.ts` | `UpdateThreadPayload` |
| `DELETE /api/discussion-threads/:id` | `deleteThread` | `apis/discussion/index.ts` | `SuccessResponse` |
| `GET /api/discussion-threads/:id/posts` | `getPosts` | `apis/discussion/index.ts` | `Post` |
| `POST /api/discussion-threads/:id/posts` | `createPost` | `apis/discussion/index.ts` | `CreatePostPayload` |
| `PATCH /api/discussion-posts/:id` | `updatePost` | `apis/discussion/index.ts` | `UpdatePostPayload` |
| `DELETE /api/discussion-posts/:id` | `deletePost` | `apis/discussion/index.ts` | `SuccessResponse` |
| `POST /api/discussion-posts/:id/report` | `reportPost` | `apis/discussion/index.ts` | `ReportPostPayload` |
| `PATCH /api/discussion-posts/:id/moderate` | `moderatePost` | `apis/discussion/index.ts` | `ModeratePostPayload` |
| `GET /api/analytics/courses/:id/overview` | `getCourseOverview` | `apis/analytics/index.ts` | `types/analytics.ts` → `CourseOverview` |
| `GET /api/analytics/courses/:id/trends` | `getCourseTrends` | `apis/analytics/index.ts` | `CourseTrends` |
| `GET /api/analytics/courses/:id/cohort-comparison` | `getCohortComparison` | `apis/analytics/index.ts` | `CohortComparison` |
| `GET /api/analytics/learners/:id/timeline` | `getLearnerTimeline` | `apis/analytics/index.ts` | `LearnerTimeline` |
| `GET /api/analytics/courses/:id/at-risk` | `getAtRiskLearners` | `apis/analytics/index.ts` | `AtRiskLearner` |
| `GET /api/analytics/me/overview` | `getMyOverview` | `apis/analytics/index.ts` | `MyOverview` |
| `POST /api/ai/risk/predict` | `predictRisk` | `apis/ai/index.ts` | `types/ai.ts` → `AiJob` |
| `GET /api/ai/jobs/:id` | `getAiJobById` | `apis/ai/index.ts` | `AiJob` |
| `GET /api/ai/jobs` | `getAiJobs` | `apis/ai/index.ts` | `AiJob` |
| `GET /api/ai/learners/:id/risk` | `getLearnerRisk` | `apis/ai/index.ts` | `LearnerRisk` |
| `GET /api/ai/models` | `getAiModels` | `apis/ai/index.ts` | `ModelVersion` |
| `POST /api/interventions` | `createIntervention` | `apis/intervention/index.ts` | `types/intervention.ts` → `Intervention` |
| `GET /api/interventions` | `getInterventions` | `apis/intervention/index.ts` | `InterventionListItem` |
| `GET /api/interventions/:id` | `getInterventionById` | `apis/intervention/index.ts` | `Intervention` |
| `PATCH /api/interventions/:id` | `updateIntervention` | `apis/intervention/index.ts` | `UpdateInterventionPayload` |
| `GET /api/interventions/:id/history` | `getInterventionHistory` | `apis/intervention/index.ts` | `InterventionHistoryItem` |
| `GET /api/notifications` | `getNotifications` | `apis/notification/index.ts` | `types/notification.ts` → `Notification` |
| `PATCH /api/notifications/:id/read` | `markNotificationRead` | `apis/notification/index.ts` | `Notification` |
| `PATCH /api/notifications/read-all` | `markAllNotificationsRead` | `apis/notification/index.ts` | `SuccessResponse` |
| `GET /api/notifications/settings` | `getNotificationSettings` | `apis/notification/index.ts` | `NotificationSettings` |
| `PATCH /api/notifications/settings` | `updateNotificationSettings` | `apis/notification/index.ts` | `NotificationSettings` |
| `GET /api/admin/overview` | `getAdminOverview` | `apis/admin/index.ts` | `types/admin.ts` → `AdminOverview` |
| `GET /api/admin/content-reports` | `getContentReports` | `apis/admin/index.ts` | `ContentReport` |
| `GET /api/admin/content-reports/:id` | `getContentReportById` | `apis/admin/index.ts` | `ContentReportDetail` |
| `PATCH /api/admin/content-reports/:id` | `resolveContentReport` | `apis/admin/index.ts` | `ResolveReportPayload` |
| `GET /api/admin/alert-settings` | `getAlertSettings` | `apis/admin/index.ts` | `AlertSettings` |
| `PATCH /api/admin/alert-settings` | `updateAlertSettings` | `apis/admin/index.ts` | `UpdateAlertSettingsPayload` |
| `GET /api/admin/audit-logs` | `getAuditLogs` | `apis/admin/index.ts` | `AuditLog` |
| `GET /api/health` | `getHealth` | `apis/health/index.ts` | `types/health.ts` → `HealthStatus` |

> **Đã xoá ở E0 (2026-10-03):** 5 dòng `/api/students` (module CRUD mẫu) không còn tồn tại — bảng
> legacy `students`, `StudentModule` và `apis/student`/`types/student.ts` ở FE đều đã bị xoá.

> **Cập nhật E3 (2026-10-03) — trạng thái thật của các dòng Course/Lesson/Enrollment ở bảng trên:**
>
> - **Đã làm ở FE:** `apis/category/index.ts`, `apis/course/index.ts`, `apis/lesson/index.ts`,
>   `apis/material/index.ts`, `apis/enrollment/index.ts` (5 file), cùng `types/course.ts` và
>   `types/lesson.ts` (đầy đủ) và `types/enrollment.ts` (chỉ `MyEnrollmentSummary` +
>   `CreateEnrollmentPayload`).
> - **`types/category.ts` và `apis/section/*` KHÔNG tồn tại** (bảng cũ trỏ tới chúng): type của danh mục
>   nằm trong `types/course.ts` (`Category`, `CategorySummary`, `PaginatedCategories`,
>   `CreateCategoryPayload`, `UpdateCategoryPayload`, `FindCategoriesParams`), còn chương nằm chung
>   `apis/lesson/index.ts` + `types/lesson.ts`.
> - **`types/course.ts` (đã đổi tên type so với bảng cũ):** `CoursePublishStatus` (cột
>   `courses.status`), `CourseVisibility`, `CourseLevel`, `CourseInstructorRole`, `LearnerCourseStatus`
>   (`'in-progress' | 'future' | 'past'` — suy diễn, chưa có nguồn dữ liệu ở E3), `CourseListItem`,
>   `CourseDetail`, `Category`, `CohortItem`, `CourseInstructorItem`, `PrerequisiteCourseRef`,
>   `CourseEligibility`, và các payload `CreateCoursePayload`/`UpdateCoursePayload`/
>   `PublishCoursePayload`/`CreateCohortPayload`/`UpdateCohortPayload`/`AssignInstructorPayload`/
>   `SetPrerequisitesPayload`/`ReorderPayload`. **`summary` là trường thật** của payload khoá học
>   (`CourseListItem.summary`, `CreateCoursePayload.summary`) — không phải thứ còn thiếu.
> - **`types/lesson.ts`:** `MaterialType` (`'text' | 'slide' | 'video' | 'file' | 'link'`),
>   `ContentFormat` (`'markdown' | 'html' | 'tiptap_json'`), `LessonDerivedType`,
>   `SectionListItem`/`SectionDetail`, `LessonListItem`/`LessonDetail`, `MaterialItem`,
>   `PaginatedSections`/`PaginatedLessons`/`PaginatedMaterials`, `FindLessonsParams`,
>   `Create/UpdateSectionPayload`, `Create/UpdateLessonPayload`, `UploadMaterialPayload`.
>   **Không** có `type`/`videoUrl`/`durationSeconds` trên bài học — xem quyết định 2 ở §7.
> - **Còn thiếu ở FE (không thuộc E3):** avatar, `POST|DELETE /api/users`, `PATCH /api/users/:id`,
>   `apis/progress`, danh sách/huỷ/tiến độ ghi danh (`getEnrollments`, `getEnrollmentById`,
>   `cancelEnrollment`, `getEnrollmentProgress`).
>
> **Ba điểm lệch giữa tài liệu/FE/backend — ĐÃ XỬ LÝ ngày 2026-10-03 (E3):**
> 1. **Hình dạng response của 3 endpoint DELETE:** trước đây backend trả `{ id }` cho
>    `DELETE /api/lessons/:id`, `DELETE /api/sections/:id`, `DELETE /api/materials/:id` trong khi
>    `apis/lesson/index.ts` + `apis/material/index.ts` khai `DefaultResponseType<{ success: boolean }>`.
>    **Đã chốt: đồng nhất theo `{ success: true }`** — và backend đã được sửa cho khớp
>    (`LessonService.deleteSection/deleteLesson/deleteMaterial`), vì mọi DELETE khác của dự án
>    (`/courses/:id`, `/categories/:id`, `/cohorts/:id`) đều trả hình dạng này. Lý do chọn
>    `{ success: true }` thay vì `{ id }`: FE không dùng id trả về để cập nhật cache (mọi thao tác xoá
>    đều refetch danh sách), còn một hình dạng chung thì không phải nhớ ngoại lệ.
> 2. **`UpdateLessonPayload` có `slug?: string`** trong khi `UpdateLessonDto` của backend không nhận
>    `slug` (`whitelist: true` gỡ bỏ âm thầm). **Đã sửa ở FE:** bỏ hẳn trường `slug` khỏi
>    `frontend/src/types/lesson.ts` — slug do backend sinh từ `title`, client không được đặt.
> 3. **DoD cấp epic E3 nói đã xoá `frontend/src/mocks/course.ts`: nay đúng.** `src/mocks/` và
>    `src/pages/course-content/` đã bị xoá hẳn; `/courses/:courseId` nay là trang chi tiết khoá học
>    (`pages/course-detail`) và trình xem bài học nằm ở `/courses/:courseId/learn[/:lessonId]`
>    (`pages/lesson-viewer`). Không còn import nào từ `@/mocks`.

**Lưu ý quan trọng cho FE (nhất quán với code hiện có):**

1. **Type dùng chung đã có sẵn**, không tạo lại: `frontend/src/types/index.ts` export `BaseEntity`, `DefaultResponseType<T>`, `PageMetaDto`, `PageOptions`. Mọi type mới **`extends BaseEntity`** và mọi hàm API trả `DefaultResponseType<T>`.
2. **Đọc `data.items` + `data.meta`** cho mọi danh sách. `ITable` nhận `itemCount` cho phân trang server-side.
3. ~~`frontend/src/types/course.ts` **hiện định nghĩa** `CourseStatus = 'in-progress' | 'future' | 'past'` …~~
   **Đã xử lý ở E3 (2026-10-03):** `types/course.ts` đã tách thành **hai** tên như đề xuất —
   `CoursePublishStatus` (`'draft' | 'published' | 'hidden' | 'archived'`, khớp cột `courses.status`)
   và `LearnerCourseStatus` (`'in-progress' | 'future' | 'past'`, nhãn UI, **chưa** có nguồn dữ liệu ở
   E3 vì tiến độ/ghi danh thuộc E4). Tên `CourseStatus` **không còn tồn tại** ở FE.
   Về các field mock: `teacher` → API trả **`owner`** `{ id, fullName, email }`; `category` là object
   `{ id, name, slug }`; `group`/`classes`/`starred` **không** có trong payload khoá học nhưng `group`/
   `classes` nay đã có bảng tương ứng là **`cohorts`** (`groupCode`/`classCode`, API ở §7
   CourseModule) — `starred` vẫn chưa có gì tương ứng (mục 13, câu hỏi 7).
4. Thêm interceptor xử lý `401` tập trung: gọi `/api/auth/refresh` rồi phát lại request; refresh thất bại → xoá token + điều hướng về trang đăng nhập (`axiosMethod.config.ts` hiện có `// NOTE: centralize error normalization here once the AI/notification toast layer exists` — đây là chỗ để làm).
5. Telemetry: gọi `sendLearningEvents` **không** `await` ở UI (fire-and-forget), gộp sự kiện theo lô tối đa 50, flush khi `visibilitychange`/`beforeunload` bằng `navigator.sendBeacon` **(đề xuất)**.
6. Điều hướng thêm mục mới phải sửa `config/sider-options/index.tsx` (nguồn chân lý duy nhất cho navigation) — xem `frontend/src/components/README.md`.
7. Dùng `PasswordInput` (`frontend/src/components/PasswordInput/PasswordInput.tsx`) cho mọi form mật khẩu — chính sách 8–16 ký tự + hoa/thường/số/ký tự đặc biệt **đã khớp** với mục 5.1.
8. Mọi thông báo lỗi hiển thị bằng `ErrorBadge` với `message` từ envelope (đã là tiếng Việt) — **không** dịch lại ở FE.

---

## 13. Câu hỏi mở / quyết định cần nhóm chốt

1. **`GET /api/students` có nâng cấp sang phân trang không?** Hiện trả mảng trần (`StudentService.findAll`), trong khi mục 3.4 chốt mọi danh sách dùng `{ items, meta }`. Nếu nâng cấp → **breaking change** với `apis/student/index.ts` (`DefaultResponseType<Student[]>`). Phương án: (a) nâng cấp + sửa FE, (b) giữ nguyên `students` như module mẫu và không dùng trong nghiệp vụ thật, (c) bỏ `students` khi `users` hoàn thành.
2. **`message` của lỗi validate: string hay array?** Code hiện tại (`AllExceptionsFilter`) nối mảng bằng `'; '` thành string. Nếu muốn FE render từng dòng lỗi dưới đúng field, phải **sửa filter toàn hệ thống** để giữ mảng. Chốt trước khi FE làm form.
3. ~~**Lưu file ở đâu?** Chưa chốt giữa đĩa cục bộ … và object storage.~~
   **✅ ĐÃ CHỐT ở E3 (2026-10-03): đĩa cục bộ.** Cách làm đã chạy trong mã nguồn
   (`backend/src/storage/storage.service.ts` + `backend/src/main.ts`):
   - Tệp học liệu ghi xuống **đĩa cục bộ**, gốc là biến `UPLOAD_DIR` (mặc định `./uploads`), mỗi bài
     một thư mục con `lessons/<lessonId>/`. Thư mục này **không** được commit (`backend/.gitignore` có
     `/uploads`).
   - **Tên tệp do server sinh**: `randomUUID()` + đuôi tra từ bảng MIME; tên tệp client gửi
     (`originalname`) **không bao giờ** được nối vào đường dẫn (chống path traversal), và `originalname`
     chỉ dùng làm tiêu đề hiển thị dự phòng.
   - Phục vụ tĩnh bằng `app.useStaticAssets(resolve(uploadDir), { prefix: '/uploads/' })` ⇒ URL
     **`/uploads/**`**, **không** có tiền tố `/api` (đây là tệp, không phải endpoint nghiệp vụ: không đi
     qua `ValidationPipe`/interceptor envelope, và phải mở được trực tiếp trong `<video>`/`<img>`).
   - `url` trả về là URL **tuyệt đối**, dựng từ biến môi trường **`PUBLIC_BASE_URL`** (mặc định
     `http://localhost:3000`) + `/uploads/<storageKey>` — vì FE chạy ở cổng khác nên đường dẫn tương
     đối không mở được trong thẻ media.
   - Đổi lại, đây là lựa chọn **không chia sẻ được giữa nhiều máy**: khi triển khai nhiều instance (hoặc
     tách container) thì `UPLOAD_DIR` phải là volume dùng chung, nếu không sẽ phải chuyển sang object
     storage. Xem thêm `RATE_LIMIT_ENABLED`/`deploy/` ở §14.
   - **Hệ quả về an toàn nội dung:** với tệp, whitelist MIME là hàng rào duy nhất (đuôi tệp tra từ
     MIME, tên tệp do server sinh). Với **nội dung HTML của bài học** (`lessons.content`), server **lưu
     nguyên văn** HTML của editor; việc chống stored-XSS nằm ở **FE lúc render** —
     `frontend/src/utils/html.ts` dùng **DOMPurify** (`sanitizeHtml`) trước `dangerouslySetInnerHTML`
     trong trang xem bài học.
4. **Idempotency của `POST /api/enrollments` và `POST /api/lessons/:id/complete`:** trả `409` hay `200` với bản ghi cũ? Mục 10.2 đang để cả hai khả năng.
   **Cập nhật E3 (2026-10-03):** đã chốt **một nửa** — `POST /api/enrollments` trả **`409`**
   `"Bạn đã đăng ký khoá học này."` khi đã có ghi danh **không** phải `dropped`; nếu ghi danh đang
   `dropped` thì **mở lại** dòng cũ (giữ lịch sử học) và trả `201`. `POST /api/lessons/:id/complete`
   vẫn **chưa có** (thuộc E4) nên vế đó vẫn mở.
5. **`POST /api/quizzes/:id/attempts` khi đang có lượt `in_progress`:** trả lại lượt đang làm (`200`) hay tạo lượt mới (`201`)? Ảnh hưởng `attemptNo` và `maxAttempts`.
6. **Khi chưa có kết quả dự đoán:** `GET /api/ai/learners/:id/risk` trả `404` hay `200` + `data: null`? Tài liệu đang nghiêng về `200` + message mô tả để FE không nhầm với lỗi.
7. **Các field mock `group`, `classes`, `starred`, `highlighted`, `CourseModuleType`:** có đưa vào schema thật không? `docs/proposal.md` không nhắc tới "nhóm lớp"/"lớp" và `docs/architecture.md` cũng không có bảng tương ứng. Cần chốt (thêm bảng `course_classes`? hay bỏ khỏi UI?).
   **Cập nhật E3 (2026-10-03):** đã chốt **một phần** — `group`/`classes` nay có bảng tương ứng là
   **`cohorts`** (`group_code`, `class_code`, `name`, `semester`, `starts_on`, `ends_on`) với API ở §7
   CourseModule; `highlighted`/`CourseModuleType` của mock là khái niệm **hiển thị của mock**, không có
   bảng. `starred` (đánh dấu yêu thích) **vẫn chưa có** gì tương ứng — cần chốt (bảng riêng cho bookmark
   hay là trạng thái cục bộ ở FE).
8. **`showAnswersAfterSubmit`:** hiện là field **(đề xuất)** trong quiz, quyết định `GET /api/submissions/:id/review` có trả đáp án đúng hay không.
9. **RBAC cho `teacher` với quiz/khoá học:** giảng viên có được tạo khoá học mới (không cần admin duyệt) không? Mục 6 đang cho phép (`courses: tạo` → teacher ✔); nếu cần quy trình duyệt thì phải thêm trạng thái `pending_review`.
   **Cập nhật E3 (2026-10-03):** đã triển khai **đúng như mục 6** — `POST /api/courses` cho `teacher`
   và **không** có bước duyệt; khoá mới luôn ở `draft` và chỉ lên sóng qua `PATCH /:id/publish` (yêu
   cầu tối thiểu một bài học). Vế quiz vẫn thuộc ExerciseModule (E5/E6), chưa có gì để chốt thêm.
10. **Email service:** `forgot-password` và can thiệp kênh `email` cần SMTP. Chưa có lựa chọn nào trong `docs/architecture.md`; giai đoạn đầu có thể chỉ ghi log token ở dev.
11. **`alert_settings` là một row duy nhất hay nhiều row theo khoá học?** Mục AdminModule đang mô tả **một** cấu hình toàn hệ thống (có `id`); nếu muốn ngưỡng riêng theo khoá thì phải thêm khái niệm override.
12. **Bảo mật dữ liệu nhạy cảm:** `docs/architecture.md` mục 2 yêu cầu "mã hoá at-rest cho các trường nhạy cảm" và "ẩn danh hoá khi dùng cho mô phỏng/huấn luyện" — cần chốt **trường nào** bị mã hoá và **ai** được xem `learning_events` thô (mục 7 hiện chỉ cho `admin`).
13. **`422` có dùng hay không** (mục 4): nếu dùng, phải thống nhất toàn bộ endpoint và cập nhật `fallbackMessages` trong `all-exceptions.filter.ts` (hiện **không có** entry cho 422 → sẽ rơi về message 500).
14. **Thứ tự ưu tiên code:** mục 2 cho thấy khối lượng lớn. Đề xuất thứ tự: Auth/User → Course/Lesson → Enrollment/Progress → Quiz/Submission → Learning events → Analytics → AI gateway/queue → Intervention/Notification → Admin.

---

## 14. Phụ lục

### 14.1 Biến môi trường trong `UniPrep/backend/.env.example`

> **Cập nhật 2026-10-03 (E0-T2):** `.env.example` đã được bổ sung **đầy đủ** các biến ở cả §14.1 và
> §14.2 (kèm chú thích cho từng nhóm), nên bảng §14.2 bên dưới **không còn là "cần bổ sung"** — nó là
> danh mục biến đã khai báo sẵn dù module tương ứng chưa code. Biến mới phát sinh khi làm module thì
> thêm vào `.env.example` **trong cùng PR**.

| Biến | Ví dụ | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng API (`configService.get('PORT') \|\| 3000` trong `main.ts`) |
| `NODE_ENV` | `development` | Môi trường chạy |
| `DB_HOST` | `localhost` | Host PostgreSQL |
| `DB_PORT` | `5432` | Cổng PostgreSQL |
| `DB_USERNAME` | `postgres` | Tài khoản DB |
| `DB_PASSWORD` | `postgres` | Mật khẩu DB |
| `DB_NAME` | `uniprep` | Tên database |
| `SWAGGER_TITLE` | `UniPrep API Docs` | Tiêu đề Swagger |
| `SWAGGER_DESCRIPTION` | `UniPrep API documentation` | Mô tả Swagger |
| `SWAGGER_VERSION` | `1.0` | Phiên bản tài liệu |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Danh sách origin được phép, phân tách bằng dấu phẩy |
| `UPLOAD_DIR` | `./uploads` | **Thêm ở E3-T4** — gốc thư mục lưu tệp học liệu trên **đĩa cục bộ**; phục vụ tĩnh tại `/uploads/**` |
| `MAX_UPLOAD_SIZE_MB` | `50` | **Thêm ở E3-T4** — trần dung lượng một tệp học liệu (byte = giá trị × 1024²); vượt → `413` |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | **Thêm ở E3-T4** — gốc URL công khai của backend (**không** kèm `/api`), dùng để dựng `url` **tuyệt đối** cho học liệu |

Biến phía frontend (`UniPrep/frontend/.env.example`): `VITE_API_BASE_URL` (mặc định `http://localhost:3000/api` theo `axiosMethod.config.ts`).

> **Ghi chú E3 (2026-10-03):** ba biến `UPLOAD_DIR`, `MAX_UPLOAD_SIZE_MB`, `PUBLIC_BASE_URL` đã được
> thêm vào `.env.example` trong cùng PR với E3-T4 — chúng **không** còn là biến "cần bổ sung". Bảng
> §14.2 chỉ liệt kê thêm để tra cứu; xem thêm `UniPrep/backend/.env.example`.

### 14.2 Biến môi trường **cần bổ sung** (chưa có trong `.env.example`)

| Biến | Ví dụ | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| `JWT_SECRET` | *(chuỗi ngẫu nhiên ≥ 32 ký tự)* | ✔ | Khoá ký JWT; **không** commit vào Git |
| `JWT_ACCESS_TTL` | `15m` | ✔ | TTL access token (mục 5.1) |
| `JWT_REFRESH_TTL` | `7d` | ✔ | TTL refresh token (mục 5.1) |
| `JWT_ALGORITHM` | `HS256` | ✖ | Thuật toán ký, mặc định HS256 |
| `PASSWORD_RESET_TTL` | `30m` | ✖ | TTL token đặt lại mật khẩu |
| `BCRYPT_SALT_ROUNDS` | `10` | ✖ | Cost băm mật khẩu |
| `REDIS_HOST` | `localhost` | ✔ (khi có queue) | Host Redis cho BullMQ + cache + rate limit |
| `REDIS_PORT` | `6379` | ✔ (khi có queue) | Cổng Redis |
| `REDIS_PASSWORD` | *(rỗng ở dev)* | ✖ | Mật khẩu Redis |
| `REDIS_DB` | `0` | ✖ | Số DB Redis |
| `AI_SERVICE_URL` | `http://ai-service:8000` | ✔ (khi có AI) | Base URL FastAPI **nội bộ** |
| `AI_SERVICE_API_KEY` | *(chuỗi ngẫu nhiên)* | ✔ (khi có AI) | API key service-to-service (mục 8.2) |
| `AI_QUEUE_NAME` | `ai-risk` | ✖ | Tên queue BullMQ |
| `AI_JOB_TIMEOUT_MS` | `300000` | ✖ | Timeout job batch |
| `UPLOAD_DIR` | `./uploads` | ✖ | **Đã có trong `.env.example` (E3-T4).** Thư mục lưu tệp học liệu — **đã chốt** là đĩa cục bộ (mục 13, câu hỏi 3) |
| `MAX_UPLOAD_SIZE_MB` | `50` | ✖ | **Đã có trong `.env.example` (E3-T4).** Giới hạn học liệu; vượt → `413` (§7 LessonModule) |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | ✖ | **Đã có trong `.env.example` (E3-T4).** Gốc URL công khai (không kèm `/api`) để dựng `url` tuyệt đối cho học liệu |
| `RATE_LIMIT_ENABLED` | `true` | ✖ | Bật/tắt rate limit (mục 10.1) |
| `LOG_LEVEL` | `info` | ✖ | Mức log ứng dụng |

> **Cập nhật E3 (2026-10-03):** câu "Toàn bộ bảng 14.2 là cần bổ sung — không biến nào trong đó xuất
> hiện ở `UniPrep/backend/.env.example` hiện tại" ở bản trước đã **hết đúng**: `.env.example` hiện khai
> báo **đầy đủ** cả bảng này (kèm `UPLOAD_DIR`/`MAX_UPLOAD_SIZE_MB`/`PUBLIC_BASE_URL` của E3-T4) — xem
> ghi chú ở đầu §14.1 (`Cập nhật 2026-10-03 (E0-T2)`), vốn đã nói đúng điều này. Bảng giữ lại như
> **danh mục tra cứu**, không phải danh sách việc cần làm.

### 14.3 Tham chiếu chéo

| Chủ đề | Tài liệu nguồn |
|---|---|
| Yêu cầu chức năng, user story, tiêu chí nghiệm thu | `docs/proposal.md` mục 3.1, 3.2 |
| Chiến lược tích hợp Hướng 5 (telemetry, xử lý nền, UI) | `docs/proposal.md` mục 4.2 |
| Kế hoạch kiểm thử & đánh giá model | `docs/proposal.md` mục 4.3 |
| Stack đã chốt | `docs/architecture.md` mục 3 |
| Phân rã module NestJS | `docs/architecture.md` mục 4 |
| Định nghĩa "nguy cơ chậm tiến độ" + feature đầu vào | `docs/architecture.md` mục 7 |
| Bảo mật, audit, ẩn danh hoá, fastAPI không public | `docs/architecture.md` mục 8 |
| Quy ước envelope/validate của code hiện tại | `UniPrep/README.md` mục *API conventions*, `backend/src/main.ts`, `common/**` |
| Quy ước FE `apis → types → pages` | `UniPrep/README.md` mục *Frontend conventions*, `frontend/src/components/README.md` |
| Chính sách mật khẩu khớp UI | `frontend/src/components/PasswordInput/PasswordInput.tsx` |
| Type dùng chung của FE | `frontend/src/types/index.ts` |
| Trạng thái triển khai | `UniPrep/README.md` mục *Status*, *Roadmap*, *Known limitations* |

---
*Tài liệu này được soạn từ `docs/proposal.md` và `docs/architecture.md`. Khi hai tài liệu đó thay đổi, cập nhật lại file này.*
