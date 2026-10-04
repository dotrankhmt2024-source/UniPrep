# Bộ tài liệu dự án UniPrep

> Phiên bản: v0.1 — Ngày: 2026-09-19

> ## ⚠️ `docs/` này là tài liệu dành cho AI agent coding — chưa phải tài liệu chính thức của nhóm
>
> Toàn bộ thư mục `docs/` **nằm ngoài repo** (`D:\Bach_Khoa\DATH\docs\`) là **bộ tài liệu làm việc
> dành cho AI agent coding**: nguồn để agent đọc, tra cứu và triển khai code. Bộ tài liệu này
> **chưa phải** tài liệu kỹ thuật chính thức của nhóm — không trích dẫn nó như tài liệu nộp giáo viên
> hay báo cáo, và nội dung trong đây có thể được sửa/thay thế tự do miễn là phục vụ việc viết code.
>
> **Tài liệu chính thức của nhóm nằm trong repo:** `UniPrep/docs/` — hiện có `proposal.md` và
> `Non_functional_req.md`, **được git theo dõi** và cả nhóm cùng sửa. Khi hai bên lệch nhau, bản trong
> `UniPrep/docs/` là bản của nhóm: hỏi ý kiến trước khi sửa, không tự ý đổi rồi coi đó là bản chính thức.

Thư mục `docs/` này chứa **bộ tài liệu làm việc mà AI agent dùng để viết code**: quy ước code, đặc tả
CSDL/API, thiết kế analytics–AI, kế hoạch triển khai, và hướng dẫn môi trường chạy.

Mục tiêu của bộ tài liệu này: **agent (hoặc một thành viên mới) đọc xong có thể bắt tay vào code mà
không cần hỏi lại** — biết phải làm gì, làm ở đâu, theo quy ước nào, và tiêu chí nào thì coi là xong.

---

## 1. Bản đồ tài liệu

### 1.1 Tài liệu gốc

| File | Bản chất | Đối tượng |
|---|---|---|
| `proposal.md` | Proposal nộp giáo viên, viết ngắn gọn vừa 4 trang (chuyển từ Word sang Markdown). **Là SOURCE OF TRUTH của dự án — cả về phạm vi lẫn về stack.** | Giáo viên, nhóm |
| `architecture.md` | Tài liệu chốt kỹ thuật với nhóm (tiếng Việt). Dùng làm **nguồn tham khảo kỹ thuật**, không được định nghĩa phạm vi sản phẩm. | Nhóm phát triển |
| `architecture_report.md` | Bản tóm tắt kiến trúc bằng tiếng Anh + sơ đồ tương tác thành phần. Dùng khi cần trình bày ngắn. | Giáo viên, nhóm |

> ## ⚠️ Thứ tự ưu tiên nguồn (đã chốt — 2026-09-26)
>
> **`proposal.md` là source of truth. Mọi tài liệu trong `docs/` phải theo `proposal.md`.**
>
> Thứ tự ưu tiên khi có mâu thuẫn:
>
> 1. **`proposal.md`** — phạm vi, yêu cầu chức năng, acceptance criteria, **và cả stack đã cam kết**
>    (proposal §5.1, §5.2 có bảng stack riêng). Đây là tài liệu đã nộp giáo viên.
> 2. **Repo `UniPrep/`** — những gì **đã thực sự có** trong code (ví dụ tên component, cấu trúc thư mục).
>    Không được mâu thuẫn với proposal về phạm vi.
> 3. **`architecture.md` / `architecture_report.md`** — chỉ dùng cho **chi tiết kỹ thuật không làm đổi
>    phạm vi** (ví dụ: danh sách module NestJS, nguyên tắc "NestJS không block", ẩn danh hoá dữ liệu).
>    **Không** dùng hai tài liệu này để mở rộng hay thu hẹp sản phẩm.
>
> **Điểm đã biết cần sửa trong `architecture.md`:** tiêu đề và §1 của tài liệu đó mô tả sản phẩm là
> *"nền tảng học tiếng Anh tích hợp AI"* với phần *"luyện nói/viết có AI chấm/gợi ý"*, và §2 nhắc
> *"chấm phát âm"*, *"inference NLP"*. **`proposal.md` không có những phần này.** Theo quy tắc trên:
> - Phạm vi sản phẩm = **nền tảng hỗ trợ học tập** (proposal §1.1, §3.1), nội dung bài học gồm
>   *text, slide, video* — **không** gắn với môn tiếng Anh, **không** bó hẹp vào ôn thi.
> - **Không** đưa "luyện nói/viết có AI chấm", "chấm phát âm", "inference NLP" vào phạm vi, backlog,
>   schema, hay API. Đây là phần **sai nguồn**, không phải phần tuỳ chọn.
> - `architecture.md` **chưa được sửa** trong repo này (là tài liệu gốc của nhóm). Việc cần làm: sửa
>   tiêu đề/§1/§2 của `architecture.md` cho khớp `proposal.md`, hoặc ghi rõ trong báo cáo rằng phần
>   tiếng Anh không thuộc phạm vi. Xem mục **C-1** trong danh sách cần chốt (§6).
>
> Những điểm khác biệt về stack giữa hai tài liệu đã được xử lý ở §3.1.

### 1.2 Tài liệu kỹ thuật (bộ tài liệu này)

> **Phạm vi áp dụng:** bộ tài liệu này nằm **ngoài repo `UniPrep/`** và là tài liệu làm việc **nội bộ
> trên máy này, dành cho AI agent coding**. Đây **chưa phải** bộ tài liệu kỹ thuật chính thức của
> nhóm — bản chính thức nằm trong `UniPrep/docs/` (`proposal.md`, `Non_functional_req.md`) và được git
> theo dõi. Repo **không** tham chiếu tới `docs/` (không link trong README của repo, không nhắc
> trong code, không cần trong CI). Repo chỉ chứa code, hướng dẫn chạy dự án, và tài liệu của nhóm.

| # | File | Nội dung | Ai đọc |
|---|---|---|---|
| 00 | `README.md` (file này) | Mục lục, quyết định đã chốt, quy ước chung toàn dự án | Tất cả |
| 01 | `01-product/requirements.md` | Đặc tả yêu cầu: chức năng, phi chức năng, user story → acceptance criteria, backlog, ma trận truy vết | Tất cả, đặc biệt khi nhận task |
| 02 | `02-specs/database-design.md` | Thiết kế CSDL: ERD, từng bảng & cột, chỉ mục, chiến lược dữ liệu chuỗi thời gian, migration, seed | Backend, dữ liệu/ML |
| 02 | `02-specs/api-specification.md` | Đặc tả REST API: quy ước, mã lỗi, RBAC, endpoint theo module, hợp đồng NestJS ↔ FastAPI, WebSocket | Backend, Frontend |
| 03 | `03-architecture/coding-conventions.md` | Quy ước code backend/frontend, cấu trúc module, cách viết entity/DTO/service/component, xử lý lỗi | Backend, Frontend |
| 03 | `03-architecture/analytics-ai-design.md` | Thiết kế Hướng 5: feature, pipeline, model, giải thích, can thiệp, dữ liệu mô phỏng, đánh giá | Dữ liệu/ML, Backend |
| 04 | `04-plan/implementation-plan.md` | WBS theo epic/task (mục 3), đường găng và thứ tự phụ thuộc kỹ thuật (mục 5.1), ma trận truy vết yêu cầu → task (mục 10) | Tất cả |
| 05 | `05-guidelines/contributing.md` | Quy trình Git/PR/review, chuẩn commit, checklist trước khi mở PR | Tất cả |
| 05 | `05-guidelines/local-development.md` | Cài đặt môi trường, chạy dự án, deploy, xử lý sự cố | Thành viên mới |

---

## 2. Lộ trình đọc

**Bắt đầu từ đâu (một lần)**
1. `../UniPrep/README.md` — repo hiện có gì, chạy thế nào.
2. `05-guidelines/local-development.md` — dựng môi trường tới khi gọi được `GET /api/health`.
3. `01-product/requirements.md` — hiểu bài toán, phạm vi, mã yêu cầu `FR-…`.
4. `05-guidelines/contributing.md` — cách commit/PR.
5. `04-plan/implementation-plan.md` — xem WBS mục 3 và đường găng mục 5.1 để biết làm gì trước.

**Khi code backend**
`02-specs/database-design.md` (schema) → `02-specs/api-specification.md` (endpoint + RBAC) → `03-architecture/coding-conventions.md` (quy ước NestJS).

**Khi code frontend**
`02-specs/api-specification.md` (mục "Checklist cho FE" + payload) → `03-architecture/coding-conventions.md` (phần Frontend) → `../UniPrep/frontend/src/components/README.md`.

**Khi làm Hướng 5 (analytics/AI)**
`02-specs/database-design.md` (bảng `learning_events`, `submissions`, `risk_predictions`) → `03-architecture/analytics-ai-design.md` → `02-specs/api-specification.md` (mục "Hợp đồng tích hợp NestJS ↔ FastAPI").

---

## 3. Quyết định đã chốt (decision log)

Các quyết định dưới đây đã được chốt và **mọi tài liệu trong `docs/` phải tuân theo**.
Muốn thay đổi, phải sửa cả `architecture.md` lẫn các tài liệu liên quan và ghi vào bảng này.

| # | Quyết định | Nguồn | Ghi chú |
|---|---|---|---|
| D1 | Backend: **NestJS (Node.js, TypeScript)** | `proposal.md` §5.1, `architecture.md` §3.2 | Đã có scaffold (NestJS 11) |
| D2 | ORM: **TypeORM** + **PostgreSQL**; **`synchronize: false` ở mọi môi trường — schema chỉ đổi qua migration** | `proposal.md` §5.1, `architecture.md` §3.2 | **Đã chuyển xong 2026-10-03 (E0-T4/T5)**: `data-source.ts` + migration baseline 25 bảng + CI kiểm tra drift. Bản cũ ghi "`synchronize: true` chỉ ở dev" |
| D3 | Auth: **JWT (access + refresh) + Passport.js**, RBAC `Student` / `Instructor` / `Admin` | `proposal.md` §3.1, §5.1 | Chưa code |
| D4 | Hàng đợi: **BullMQ + Redis** cho job AI nặng; NestJS không block | `proposal.md` §5.1, `architecture.md` §2 | Chưa code |
| D5 | AI service: **FastAPI (Python) tách rời**, không expose internet, chỉ đọc dữ liệu cần thiết và ghi kết quả dự đoán | `proposal.md` §5.2, `architecture.md` §3.3, §8 | Chưa code |
| D6 | Frontend: **React (Vite) + TypeScript** | `proposal.md` §5.1 | Đã có scaffold (React 19 + Vite 6) |
| D7 | Styling: **Tailwind CSS + Ant Design** + token Material 3 | `proposal.md` §5.1 (Ant Design) | Repo: Tailwind 4 + antd 6 |
| D8 | State cục bộ: **Redux** (`@reduxjs/toolkit` + `react-redux`) | `proposal.md` §5.1, `architecture.md` §3.1 | **Đã sửa 2026-09-26**: gỡ `zustand` (khai báo nhưng không dùng ở đâu) và cài Redux Toolkit |
| D9 | Mọi response API dùng envelope `{ error, data, message }` | repo thật | Đã có interceptor/filter |
| D10 | Text hiển thị cho người dùng: **tiếng Việt**; định danh code, tên bảng/cột, field JSON: **tiếng Anh** | repo thật | Xem `coding-conventions.md` |
| D11 | **Không dùng TypeScript `enum`** → dùng union type (`type RiskLevel = 'low' \| 'medium' \| 'high'`) | repo thật (`types/course.ts`) | Tránh lệch kiểu với Postgres varchar |
| D12 | Khoá chính **UUID**, entity kế thừa `BaseEntityCustom` (`id`, `createdAt`, `updatedAt` — cột snake_case) | repo thật | **Đã sửa 2026-09-26**: thêm `name: 'id'/'created_at'/'updated_at'` vào entity cơ sở |
| D13 | Tên bảng/cột trong Postgres: **snake_case, số nhiều, tiếng Anh**; field TS: camelCase (mọi `@Column` ghi rõ `name`) | repo thật (`student.entity.ts`) | |
| D14 | **Phạm vi sản phẩm lấy theo `proposal.md`**: UniPrep là **nền tảng hỗ trợ học tập** (khoá học, chương/bài, học liệu, quiz, tiến độ, thảo luận, analytics). **Không** có phần học tiếng Anh, luyện nói/viết, chấm phát âm | `proposal.md` §1.1, §3.1 | Chốt 2026-09-26 — xem §6.2 |
| D15 | Tên sản phẩm: **UniPrep** (không dùng "EduLMS Portal") | Chốt với nhóm 2026-09-26 | Dùng cho UI, báo cáo, tài liệu |

### 3.1 Điểm lệch giữa các nguồn (đã xử lý)

Các điểm dưới đây lệch nhau giữa `proposal.md`, `architecture.md` và repo thật. Cột "Đã chốt trong
docs" là **quyết định cuối cùng**; hai điểm X1 và X3 đã được **sửa cả trong code** ngày 2026-09-26.

| # | Điểm lệch | `proposal.md` (source of truth) | `architecture.md` | Repo thật | Đã chốt trong docs |
|---|---|---|---|---|---|
| X1 | State management FE | "Redux" (§5.1) | "Redux Toolkit" (§3.1) | Trước đây khai báo **Zustand** nhưng **không dùng ở đâu** | **Redux Toolkit** (D8). Đã gỡ `zustand`, cài `@reduxjs/toolkit` + `react-redux`. Đây là task nhỏ vì chưa có store nào được viết |
| X2 | Charts FE | "Ant Design (Charts…)" (§5.1) | "antd/Charts" (§3.1) | Ant Design 6, chưa có thư viện chart riêng | **Để tới lúc làm dashboard sẽ chốt** (C-4 đã chốt cách xử lý) |
| X3 | Định vị sản phẩm | Nền tảng hỗ trợ học tập (khoá học, học liệu, quiz, tiến độ, thảo luận); nội dung gồm **text, slide, video** (§1.1, §3.1) | "Nền tảng **học tiếng Anh** tích hợp AI" + "luyện nói/viết có AI chấm" (§ tiêu đề, §1, §2) | Mockup là LMS học tập nói chung ("EduLMS Portal", CS102 Cấu trúc dữ liệu) | **Theo proposal** (D14): hỗ trợ học tập nói chung, không gắn môn tiếng Anh. **Toàn bộ phần "luyện nói/viết có AI chấm", "chấm phát âm", "inference NLP" bị loại khỏi phạm vi.** Cần sửa `architecture.md` cho khớp (C-1) |
| X4 | Tên sản phẩm | "online learning and exam preparation platform" | "UniPrep" | **UniPrep** (mockup ghi "EduLMS Portal") | **UniPrep** (D15) — đã chốt 2026-09-26 |
| X5 | Real-time | "Socket.IO client (Optional)" | "Socket.IO client (tuỳ chọn)" | Chưa có | Coi là **tuỳ chọn**; mặc định dùng polling cho trạng thái job AI |
| X6 | Vai trò người dùng | `Learner` / `Instructor` / `Administrator` (§1.2) | `student` / `teacher` / `admin` (§3.2) | `student` (module mẫu) | Giữ **định danh code** `student`/`teacher`/`admin` (D3) vì ngắn và đã dùng trong repo; **nhãn hiển thị** dùng "Học viên / Giảng viên / Quản trị viên" |

---

## 4. Quy ước chung áp dụng cho mọi tài liệu trong `docs/`

1. **Ngôn ngữ**: tài liệu viết tiếng Việt; thuật ngữ kỹ thuật giữ tiếng Anh (ví dụ "endpoint",
   "middleware", "migration", "queue"). Tên file dùng tiếng Anh, kebab-case.
2. **Nhãn trạng thái**: khi mô tả một thành phần, luôn nói rõ nó **đã có trong repo** hay **cần làm**.
   Chỉ những gì tồn tại trong `UniPrep/` mới được gọi là "đã có".
3. **Không bịa số liệu**: mọi con số về kết quả (độ chính xác model, thời gian chạy, số dòng dữ liệu)
   phải để trống kèm ghi chú `<cần điền>`. Ước lượng công việc phải ghi rõ là ước lượng.
4. **Không bịa API/bảng**: tên endpoint, tên bảng, tên biến môi trường phải tồn tại trong tài liệu
   tương ứng. Nếu là đề xuất mới, ghi rõ `(đề xuất)`.
5. **Đề xuất vs bắt buộc**: dùng `(đề xuất)` cho những gì nhóm có thể đổi; không đánh dấu nghĩa là
   bắt buộc tuân theo.
6. **Cập nhật tài liệu**: khi thay đổi schema/API/stack, sửa tài liệu trong cùng PR với code.
   Xem `05-guidelines/contributing.md` §"Tài liệu".

---

## 5. Trạng thái hiện tại của dự án (tại thời điểm soạn tài liệu)

**Đã có trong repo `UniPrep/`:**

- Backend NestJS chạy được: response envelope, exception filter, `ValidationPipe` toàn cục,
  Swagger tại `/docs`, health check có kiểm tra kết nối DB. **Module CRUD mẫu `student` đã bị xoá ở E0**
  (bảng legacy `students` không thuộc ERD).
- **Tầng schema lõi (E0, 2026-10-03):** 25 entity theo `02-specs/database-design.md`, `synchronize: false`,
  `backend/src/database/data-source.ts`, migration baseline sinh bằng CLI + block index viết tay, seed
  idempotent (`npm run seed`), script `migration:generate/run/revert/show`, `schema:log`, `openapi:export`.
- **Xác thực & phân quyền (E1, 2026-10-03):** `AuthModule` (đăng ký, đăng nhập qua Passport local, JWT
  access 15 phút + refresh 7 ngày có rotation/thu hồi trong `refresh_tokens`, quên/đặt lại/đổi mật khẩu
  với `password_reset_tokens`), hash **bcryptjs cost 10**; `JwtAuthGuard` + `RolesGuard` đăng ký
  **toàn cục** (mặc định chặn mọi route, chỉ mở bằng `@Public()` — danh sách public ở
  `02-specs/api-specification.md` §5.4); `OwnershipGuard` chống IDOR; khoá tài khoản tạm 15 phút sau 10
  lần đăng nhập sai; `PATCH /api/users/:id/status` cho admin (thu hồi mọi phiên ngay).
- **Frontend đăng nhập (E1-T7/T8):** trang Đăng nhập/Đăng ký/Quên/Đặt lại mật khẩu, Redux Toolkit +
  `localStorage` cho phiên, `AuthProvider`, axios interceptor gắn token và **tự refresh khi 401** (gộp
  nhiều request hỏng vào một lần refresh), `ProtectedRoute` theo vai trò và menu Sider lọc theo vai trò.
- **Hồ sơ & quản trị người dùng (E2-T1/T2/T4/T5, 2026-10-03):** `GET|PATCH /api/users/me` (chỉ 4 trường
  `fullName`/`phone`/`major`/`bio` — `role`/`status`/`email` bị `whitelist` loại bỏ), `GET /api/users`
  (lọc `search`/`role`/`status`, phân trang có trần `take ≤ 100`, sắp xếp theo danh sách trắng),
  `PATCH /api/users/:id/role` (chặn admin tự hạ vai trò mình, thu hồi phiên khi vai trò đổi thật); phía
  FE có trang Hồ sơ cá nhân (xem/sửa/đổi mật khẩu) và trang Quản lý người dùng cho admin (`ITable` +
  lọc + phân trang thật). Dùng chung `PaginationQueryDto`/`PageMetaDto` ở `backend/src/common/dto`.
- **Khoá học & nội dung (E3, 2026-10-03):** `CourseModule` (danh mục, khoá học, phân công giảng viên,
  lớp `cohorts`, điều kiện tiên quyết, ghi danh tối thiểu) + `LessonModule` (chương, bài học, học liệu)
  + `StorageService` (upload lên đĩa cục bộ, whitelist MIME, `413`/`415`, chống path traversal). Migration
  `1791022171040-CreateCohortsInstructorsPrerequisites` tạo `cohorts` + `course_instructors` +
  `course_prerequisites` và thêm FK cho `enrollments.cohort_id` (đóng E2-T3). Mọi quyết định "ai được
  xem/sửa gì" đi qua **một** `CourseAccessService` (chủ sở hữu **hoặc** dòng `course_instructors`, admin
  luôn qua). Phía FE: catalog thật ở `/`, chi tiết khoá học + syllabus + nút đăng ký ở `/courses/:id`,
  trình xem bài học (HTML đã sanitize bằng DOMPurify, video phát được, bài trước/sau) ở
  `/courses/:id/learn`, và khu soạn nội dung của giảng viên ở `/teacher/courses`.
  `frontend/src/mocks/course.ts` **đã bị xoá** (DoD cấp epic E3); seed bổ sung 4 lớp + 4 phân công
  giảng viên để E8 có dữ liệu kiểm thử phạm vi theo lớp.
- Frontend React chạy được: design system dùng chung (Badge, ITable, FormItem, các loại Button,
  Icon, RichTextEditor, PasswordInput), layout private (Header + Sider + Outlet), theme Material 3 cho
  Tailwind và antd.
- Quy ước & công cụ: husky + lint-staged ở `package.json` gốc (chặn commit lỗi lint), `lint:ci`,
  `.github/ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`, `labels.yml`.
- CI: 3 job — frontend (lint + build), backend (lint + build), migrations (Postgres service container:
  `up` → revert hết → `up` → chặn nếu `schema:log` khác rỗng). Deploy tự động lên runner Windows
  self-hosted qua Cloudflare tunnel.

**Chưa có (toàn bộ nằm trong kế hoạch):**

- dto/service/controller cho các module nghiệp vụ còn lại (entity đã có), endpoint
  ghi `learning_events`, analytics, queue Redis/BullMQ, service FastAPI, thông báo/can thiệp/quản trị.
- **Lớp/nhóm theo phạm vi dữ liệu giảng viên:** E2-T3 **đã xong ở E3** (bảng `cohorts`,
  `course_instructors.cohort_id`, seed 4 lớp + phân công theo lớp). Điều **chưa** có là truy vấn lọc
  dữ liệu học viên theo lớp — việc đó thuộc dashboard E8. `POST|DELETE /api/users`, `DELETE /api/users/:id`
  và avatar người dùng vẫn là đặc tả đích.
- **Rate limit theo IP (`429`)** — E1 chỉ làm khoá tài khoản theo `failed_login_count`; phần IP hoãn sang
  E13-T4 (xem `02-specs/api-specification.md` §10.1).
- **Test suite:** E4 có 4 unit tests cho progress; E5 thêm 8 unit tests grading và HTTP e2e assessment
  trên PostgreSQL test riêng. E0-T7, E1-T9, e2e của E1-T6, E2-T6 và E3-T10 vẫn hoãn sang E13; các
  kiểm chứng E1/E2/E3 trước đây chủ yếu là script e2e dùng một lần, không commit.
- **Ghi danh & tiến độ (E4, 2026-10-03):** đã có danh sách/chi tiết/huỷ ghi danh, progress theo ghi
  danh/khoá, hoàn thành/bỏ hoàn thành bài, phần trăm theo bài published và resume. FE có trang
  `/my-courses`; huỷ chuyển `dropped`, giữ tiến độ và đăng ký lại mở lại enrollment cũ.
- **Quiz & chấm điểm (E5, 2026-10-03):** `ExerciseModule` có API quiz/câu hỏi, attempt dựa trên
  `submissions`, chấm tự động câu trắc nghiệm, giới hạn thời gian/lượt làm, review và feedback giảng
  viên. Frontend có danh sách quiz, làm bài với timer + lưu nháp cục bộ, kết quả và khu giảng viên tạo
  đề/quản lý câu hỏi/xem bài nộp. Không cần migration; schema E5 đã nằm trong baseline. Quiz score đã
  sẵn sàng cho feature store E8; learning events và early warning vẫn thuộc E7/E8/E9/E11.

---

## 6. Việc cần chốt

> **Nguyên tắc (chốt 2026-09-26):** việc gì thuộc về **con người, tiến độ, phân công, họp hành** thì
> **không** đưa vào bộ tài liệu kỹ thuật này — tài liệu ở đây chỉ phục vụ việc code. Việc gì thuộc về
> **thiết kế/code** thì **để tới lúc làm module đó sẽ chốt**, không chặn trước. Vì vậy các danh sách
> cũ (§6.2 con người, §6.3 thiết kế) đã được **bỏ khỏi tài liệu này** — xem §6.3 bên dưới.

### 6.1 Cần sửa tài liệu gốc cho khớp phạm vi mới

| # | Việc | Vì sao | Trạng thái |
|---|---|---|---|
| **C-1** | Sửa tiêu đề, §1 và §2 của `docs/architecture.md`: bỏ "nền tảng học tiếng Anh", bỏ "luyện nói/viết có AI chấm/gợi ý", "chấm phát âm", "inference NLP" | `proposal.md` là source of truth và không có các phần này; tài liệu gốc đang mô tả một sản phẩm khác | **Chưa làm** — `architecture.md` là tài liệu gốc của nhóm, cần cả nhóm đồng ý sửa |
| **C-3** | Sửa mục "4. AI Component" của `docs/architecture_report.md`: bỏ *"speaking and writing assessment"*, và sửa `skill_scores` → tên bảng đúng (`quizzes`, `risk_feature_contributions`, …) | Cùng lý do C-1; `skill_scores` không tồn tại trong thiết kế CSDL | **Chưa làm** |

### 6.2 Đã chốt (không còn là câu hỏi mở)

| # | Việc | Kết quả chốt | Ngày |
|---|---|---|---|
| ~~C-35~~ | **Phạm vi sản phẩm** | **UniPrep là nền tảng hỗ trợ học tập nói chung.** Phạm vi lấy theo `proposal.md` (D14). Bỏ hẳn định hướng "học tiếng Anh"; **không** có luyện nói/viết, chấm phát âm, NLP. Nội dung bài học: text/slide/video + quiz trắc nghiệm | 2026-09-26 |
| ~~C-2~~ | **Tên sản phẩm** | **UniPrep** — dùng thống nhất trong tài liệu, UI và báo cáo. Không dùng "EduLMS Portal" (tên cũ trong mockup) cho code/tài liệu mới | 2026-09-26 |
| ~~C-4~~ | **Thư viện biểu đồ** | **Để tới lúc làm module dashboard sẽ chốt** (task E8-T6). Trước đó không chặn gì; không đưa lựa chọn cụ thể vào tài liệu | 2026-09-26 |
| ~~C-5~~ | **Repo có trỏ sang `docs/` không?** | **Không.** `docs/` là tài liệu nội bộ trên máy này, nằm ngoài repo. Repo không link, không nhắc, không cần biết tới `docs/` | 2026-09-26 |
| ~~C-30~~ | Phạm vi theo `proposal.md` hay `architecture.md`? | **Theo proposal** (D14). Loại bỏ phần luyện nói/viết/chấm phát âm khỏi mọi tài liệu kỹ thuật | 2026-09-26 |
| ~~C-31~~ | `BaseEntityCustom` sinh cột camelCase | **Đã sửa** `base-custom.entity.ts`: thêm `name: 'id' / 'created_at' / 'updated_at'`, kiểu `timestamptz`. Không thêm `SnakeNamingStrategy` | 2026-09-26 |
| ~~C-32~~ | Comment trong `ci.yml` mô tả sai script lint | **Đã sửa** comment cho khớp `backend/package.json` (`eslint "src/**/*.ts" --fix`); lý do CI không dùng `npm run lint` là **không được `--fix` trên CI** | 2026-09-26 |
| ~~C-33~~ | Zustand hay Redux cho state management | **Redux** (D8, theo proposal §5.1). Đã gỡ `zustand`, cài `@reduxjs/toolkit` + `react-redux`, cập nhật lockfile | 2026-09-26 |

### 6.3 Không đưa vào tài liệu (chốt tới đâu làm tới đó)

Các việc dưới đây **cố ý không** có bảng theo dõi trong `docs/`:

| Nhóm | Cách xử lý |
|---|---|
| **Con người & tiến độ** (số thành viên, giờ/tuần, phân công, deadline nội bộ, họp hành, ai review gì, trực deploy) | Không thuộc phạm vi tài liệu kỹ thuật. Agent dùng để viết code **không cần** biết. Phần kế hoạch trong `04-plan/implementation-plan.md` chỉ giữ **thứ tự phụ thuộc kỹ thuật** (WBS mục 3, đường găng mục 5.1), không phải cam kết lịch |
| **Quyết định thiết kế nhỏ** (danh mục phẳng hay phân cấp, giới hạn dung lượng upload, module riêng hay gộp, token lưu ở đâu, lưu tệp ở đâu, có gửi email thật không, ngưỡng rủi ro, bao phủ test, …) | **Để tới lúc làm module đó sẽ chốt.** Mỗi quyết định khi chốt thì ghi thẳng vào tài liệu của module tương ứng (schema → `database-design.md`, endpoint → `api-specification.md`, quy ước code → `coding-conventions.md`) và ghi một dòng vào §3 (decision log) |
| **Thư viện biểu đồ** | Chốt ở task E8-T6, cùng lúc dựng dashboard |
| **Chi tiết thuộc môi trường máy này** (đường dẫn, tunnel, runner, branch protection) | Chỉ ghi những gì cần để **chạy code** (`local-development.md`); phần vận hành nhóm không đưa vào |

> **Cách ghi khi chốt một quyết định mới:** thêm một dòng vào bảng decision log (§3) với cột
> "Nguồn" ghi rõ là quyết định của nhóm ngày nào, rồi sửa tài liệu module liên quan **trong cùng lần
> đó**. Không để quyết định chỉ tồn tại trong đầu người chốt.

---

*Tài liệu này là mục lục và nguồn quy ước chung cho `docs/`. Khi thêm tài liệu mới, cập nhật §1.2,
§2 và §6.*
