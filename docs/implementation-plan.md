# Kế hoạch triển khai — UniPrep

## Thành phần nâng cao Hướng 5: Learning Analytics & Cảnh báo sớm — nền tảng hỗ trợ học tập UniPrep

> Phiên bản: v0.1 — Ngày: 2026-09-26

---

## 0. Mục đích tài liệu

Tài liệu này là **kế hoạch triển khai (implementation plan)** dùng làm công cụ quản lý công việc
thực tế cho nhóm đồ án: nó trả lời bốn câu hỏi.

1. **Làm cái gì** — danh sách công việc phân rã theo epic → feature → task (mục 3), mỗi task có ID,
   ước lượng, phụ thuộc, tiêu chí hoàn thành kiểm chứng được và nhãn.
2. **Làm theo thứ tự nào** — thứ tự phụ thuộc kỹ thuật giữa các epic (mục 6), đường găng (mục 5), và
   các mốc kỹ thuật theo timeline của `docs/proposal.md` §6.1 (mục 4).
3. **Rủi ro và cách kiểm soát** — chiến lược kiểm thử (mục 7), môi trường & triển khai (mục 8),
   quản lý rủi ro (mục 9) và ma trận truy vết (mục 9).

> **Tài liệu này KHÔNG quản lý con người.** Phân công thành viên, ước lượng theo người, họp hành, quy
> ước nhánh/PR/review đã được **bỏ khỏi tài liệu này** (chốt 2026-09-26) — xem `README.md` §6.3. Tài
> liệu ở đây chỉ phục vụ việc viết code: làm gì, theo thứ tự nào, kiểm chứng bằng gì. Các cột "Người
> nhận" trong mục 3 vì vậy **để trống** và không cần điền.

Tài liệu này **không** thay thế `docs/proposal.md` (source of truth về yêu cầu, phạm vi và stack) và
`docs/architecture.md` (tham khảo chi tiết kỹ thuật không đổi phạm vi). Khi có mâu thuẫn, thứ tự ưu tiên:
`proposal.md` → `architecture.md` → `docs/04-plan/implementation-plan.md` (cách thực thi).

### 0.1. Phạm vi tài liệu

| Trong phạm vi | Ngoài phạm vi |
|---|---|
| Công việc phân rã theo epic → task, thứ tự phụ thuộc kỹ thuật | Thiết kế chi tiết UI/UX từng màn hình (thuộc wireframe/Figma) |
| Mốc kỹ thuật theo timeline 39–50, đường găng | Nội dung học thuật của khoá học mẫu |
| Chiến lược kiểm thử, DoD, môi trường, deploy, rollback | Hợp đồng API chi tiết từng field (thuộc `docs/02-specs/api-specification.md`) |
| Rủi ro kỹ thuật và phương án dự phòng | **Nhân sự, phân công, họp hành, ngày công của người** — xem `README.md` §6.3 |

---

## 3. Kiến trúc phân rã công việc (WBS)

### 3.0. Cách đọc bảng task

Mỗi task có các cột:

| Cột | Ý nghĩa |
|---|---|
| **ID** | `E<epic>-T<task>`, ví dụ `E3-T2`. ID này được dùng lại ở mục 4 (lịch trình) và mục 11 (truy vết) |
| **Ưu tiên** | `P0` / `P1` / `P2` theo mục 2.4 |
| **Est.** | Ước lượng, đơn vị **ngày công (8h)** |
| **Phụ thuộc** | Task phải xong trước; `—` nghĩa là không phụ thuộc |
| **Nhãn** | `backend` / `frontend` / `ai` / `db` / `devops` / `docs` |
| **Người nhận** | **ĐỂ TRỐNG** — nhóm điền ở mục 6.2 |
| **DoD** | Tiêu chí hoàn thành **kiểm chứng được** (không viết "hoàn thành chức năng X") |

Quy đổi tham khảo: **1 điểm story ≈ 0,5 NC**. Một task `3 NC` ≈ `6 điểm story`.

**Bảng tổng hợp WBS:**

| Epic | Tên | Số task | Ước lượng (NC) | Trong đó P0 |
|---|---|---|---|---|
| E0 | Tiền đề | 12 | 19,0 | 14,0 |
| E1 | Xác thực & phân quyền | 9 | 21,0 | 15,5 |
| E2 | Người dùng & hồ sơ | 6 | 13,5 | 4,5 |
| E3 | Khoá học & nội dung | 10 | 28,5 | 17,5 |
| E4 | Học tập & tiến độ | 6 | 13,0 | 10,0 |
| E5 | Quiz & chấm điểm | 9 | 25,5 | 16,5 |
| E6 | Thảo luận & kiểm duyệt | 5 | 11,5 | 0,0 |
| E7 | Telemetry hành vi | 6 | 15,5 | 10,5 |
| E8 | Analytics dashboard | 8 | 26,0 | 18,0 |
| E9 | AI service & pipeline rủi ro | 12 | 37,5 | 24,5 |
| E10 | Giải thích & can thiệp | 6 | 16,5 | 14,0 |
| E11 | Thông báo | 6 | 12,5 | 4,5 |
| E12 | Quản trị & audit | 5 | 12,5 | 3,0 |
| E13 | Kiểm thử chất lượng | 9 | 28,5 | 19,5 |
| E14 | Báo cáo & demo | 8 | 24,5 | 22,5 |
| | **Tổng** | **117** | **305,5** | **194,5** |

---

### E0 — Tiền đề (thiết lập quy ước, migrations, seed, môi trường, CI/CD)

**Mục tiêu:** đưa repo từ "scaffold chạy được" thành "nền đủ chắc để 5 người làm song song":
có migration (tắt `synchronize`), có seed tái lập được, có CI chạy cả test, có quy ước viết sẵn.

**Ánh xạ yêu cầu:** proposal §3.1 (toàn bộ — điều kiện nền), §6.1 tuần 39, §6.3 (checkpoint, task gắn commit).

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E0-T1 | Chốt quy ước repo & tài liệu (tên module, naming DB, union type thay enum, ngôn ngữ) | P0 | 1,0 | — | docs | | Có mục quy ước trong `docs/03-architecture/coding-conventions.md`; code mới tuân thủ quy ước; `npm run lint` + `npm run build` xanh ở cả hai phía |
| E0-T2 | Chuẩn hoá môi trường dev local (Windows + Postgres local + `.env.example` đầy đủ biến) | P0 | 1,0 | E0-T1 | devops | | Một máy sạch làm theo README chạy được `npm ci && npm run dev` cả FE/BE trong ≤ 30 phút, `GET /api/health` trả `database: "up"` |
| E0-T3 | ESLint + Prettier + pre-commit hook (husky + lint-staged) cho cả `backend/` và `frontend/` | P1 | 1,5 | E0-T2 | devops | | Commit có file lỗi lint bị chặn ở máy; `npm run lint` chạy sạch trên repo hiện tại |
| E0-T4 | Tắt `synchronize: true`, tạo `data-source.ts` cho TypeORM CLI, thêm script `migration:generate/run/revert` | P0 | 1,5 | E0-T2 | db | | `synchronize` bằng `false` trong mọi môi trường; `npm run migration:run` trên DB rỗng tạo đủ bảng; `migration:revert` chạy được |
| E0-T5 | Migration baseline cho toàn bộ bảng lõi (`users`, `refresh_tokens`, `categories`, `courses`, `course_sections`, `lessons`, `lesson_materials`, `enrollments`, `lesson_progress`, `quizzes`, `quiz_questions`, `quiz_options`, `submissions`, `submission_answers`, `discussion_threads`, `discussion_posts`, `content_reports`, `learning_events`, `risk_predictions`, `interventions`, `notifications`, `alert_settings`, `ai_jobs`, `model_versions`, `audit_logs`) | P0 | 2,5 | E0-T4 | db | | Migration sinh bằng CLI (không viết tay toàn bộ), review bởi ≥1 người; chạy `up` rồi `down` rồi `up` không lỗi; schema có index cho `learning_events(user_id, occurred_at)` |
| E0-T6 | Seed script: 3 tài khoản theo vai trò, 2 khoá học, ≥10 bài học, ≥1 quiz/khoá, ≥30 học viên + enrollment + learning_events mẫu | P0 | 2,5 | E0-T5 | db | | `npm run seed` idempotent (chạy 2 lần không nhân đôi dữ liệu); tài khoản demo đăng nhập được sau khi E1 xong; dữ liệu đủ để dashboard có số liệu |
| E0-T7 | Thêm job `test` vào `ci.yml` (Jest backend + Vitest frontend — Vitest là **đề xuất**) | P1 | 1,5 | E0-T3 | devops | | CI có job test chạy trên PR; job đỏ khi cố tình thêm 1 test fail; thời gian job < 5 phút |
| E0-T8 | Job CI kiểm tra migration trên Postgres service container (chạy `up` + `down` + `up`) | P1 | 1,5 | E0-T5 | devops | | CI đỏ khi migration lệch với entity; không cần DB thật của môi trường dev |
| E0-T9 | Đồng bộ việc lint backend: sửa **comment lỗi thời** trong `ci.yml` (đang nói script lint là `eslint "{src,apps,libs,test}/**/*.ts" --fix`, trong khi `backend/package.json` thực tế ghi `eslint "src/**/*.ts" --fix`) và thêm script `lint:ci` = `eslint "src/**/*.ts"` (không `--fix`) để dev chạy đúng như CI | P1 | 0,5 | E0-T3 | devops | | Comment trong `ci.yml` khớp `package.json`; `npm run lint:ci` báo lỗi thay vì tự sửa; CI vẫn gọi `npx eslint "src/**/*.ts"` |
| E0-T10 | Template Issue + PR (`.github/ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`) và quy ước nhãn | P0 | 1,0 | E0-T1 | docs | | Tạo issue mới hiện đúng template; PR mới hiện checklist; nhãn đã tạo đủ theo mục 7.4 |
| E0-T11 | Chốt ERD + API spec và lưu thành `docs/02-specs/api-specification.md` + `docs/02-specs/database-design.md`; export OpenAPI từ Swagger thành tệp trong repo | P0 | 2,0 | E0-T1 | docs | | FE và AI service cùng đọc 1 nguồn; mọi endpoint MVP có trong spec với request/response; spec khớp Swagger thật tại `/docs` |
| E0-T12 | Wireframe + mapping design system cho 6–8 màn hình trọng yếu | P0 | 2,5 | E0-T1 | docs | | Mỗi màn hình ghi rõ component dùng từ `src/components` (không vẽ lại HTML thủ công); được review trong checkpoint tuần 39 |

**DoD cấp epic E0:** `develop` build xanh, CI có job test, DB dựng lại được từ 0 bằng migration + seed
trên một máy bất kỳ: clone repo → tạo DB → `npm ci` → `migration:run` → `npm run seed` → chạy được trong ≤ 30 phút.

> ### Trạng thái E0 — chốt ngày 2026-10-03
>
> **Đã xong:** E0-T1, E0-T2, E0-T3, E0-T4, E0-T5, E0-T6, E0-T8, E0-T9, E0-T10, E0-T11, E0-T12.
> Bằng chứng: migration baseline 25 bảng chạy `up → down → up` trên DB rỗng; `schema:log` rỗng (không lệch
> entity); `npm run seed` idempotent (chạy 2 lần không nhân đôi); `GET /api/health` trả `database: "up"`;
> lint + build xanh cả hai phía; `backend/openapi.json` xuất từ chính app.
>
> **Chưa làm — có chủ đích:** **E0-T7 (job `test` trong CI) hoãn** theo quyết định của nhóm ngày
> 2026-10-03 ("không cần test ở giai đoạn này"); vì vậy DoD cấp epic ở dòng trên **chưa đạt** phần
> "CI có job test" — sẽ làm ở E13-T1/E13-T3. Job CI kiểm tra migration (E0-T8) thì **đã có**.
>
> **Lệch so với tài liệu (đã cập nhật `database-design.md` §9.2):** repository dùng **một** migration
> baseline (`1791015645541-BaselineCoreSchema.ts`) thay vì tách 5 file theo cụm, và **xoá luôn bảng
> legacy `students`** ngay trong E0 thay vì migration `MigrateStudentsToUsers` (§9.1 bước 8 không cần nữa).
> Phạm vi baseline đúng 25 bảng như bảng E0-T5 — `password_reset_tokens`, `course_instructors`,
> `cohorts`, `risk_feature_contributions` và 2 materialized view do các epic sau thêm.

---

### E1 — Xác thực & phân quyền

**Mục tiêu:** có danh tính thật cho 3 vai trò và mọi API đều được bảo vệ đúng. Đây là epic
**chặn toàn bộ phần còn lại** — không có auth thì không thể biết "học viên nào", do đó không có
telemetry, không có analytics.

**Ánh xạ yêu cầu:** proposal §3.1 "Account and authorization"; user story Student/Instructor/Admin;
architecture.md §4 `AuthModule`, `UserModule`.

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E1-T1 | `AuthModule`: đăng ký + đăng nhập (LocalStrategy, hash mật khẩu bằng argon2/bcrypt) | P0 | 2,5 | E0-T5 | backend | | `POST /api/auth/register`, `POST /api/auth/login` trả envelope chuẩn; sai mật khẩu trả 401 với message tiếng Việt; mật khẩu không bao giờ xuất hiện trong response/log |
| E1-T2 | JWT access + refresh token, rotation, thu hồi (`refresh_tokens`), endpoint `POST /api/auth/refresh`, `POST /api/auth/logout` | P0 | 3,0 | E1-T1 | backend | | Access token ngắn hạn, refresh dài hạn; refresh cũ dùng lại bị từ chối; logout thu hồi được token; có unit test cho rotation |
| E1-T3 | RBAC: decorator `@Roles()`, `@Public()`, `RolesGuard` áp dụng toàn cục, `JwtAuthGuard` mặc định bảo vệ mọi route | P0 | 2,0 | E1-T2 | backend | | Route không có `@Public()` mà không có token → 401; sai vai trò → 403; `GET /api/health` vẫn public; danh sách route public được liệt kê trong tài liệu |
| E1-T4 | Quên / đặt lại mật khẩu (token dùng 1 lần, hết hạn; email ở chế độ dev ghi ra log/MailHog) | P1 | 2,0 | E1-T2 | backend | | `POST /api/auth/forgot-password` không tiết lộ email có tồn tại hay không; token hết hạn bị từ chối; token dùng lại bị từ chối |
| E1-T5 | Quản lý trạng thái tài khoản (`active` / `locked` / `pending`) và chặn đăng nhập | P1 | 1,5 | E1-T1 | backend | | Tài khoản `locked` không đăng nhập được (message rõ ràng, không phải 401 chung chung); admin đổi trạng thái được |
| E1-T6 | Guard kiểm tra quyền sở hữu dữ liệu (chống IDOR): học viên chỉ đọc/ghi dữ liệu của chính mình | P0 | 2,0 | E1-T3 | backend | | Có ≥2 e2e: học viên A gọi `GET` tài nguyên của học viên B → 403/404; giảng viên chỉ truy cập khoá mình phụ trách |
| E1-T7 | Frontend: trang Đăng nhập / Đăng ký / Quên mật khẩu, `AuthProvider`, axios interceptor gắn token & tự refresh khi 401 | P0 | 4,0 | E1-T2, E0-T12 | frontend | | Đăng nhập thành công điều hướng vào layout private; token hết hạn được refresh trong suốt (không văng ra login khi đang thao tác); dùng đúng `ISolidBtn`, `FormItem`, `PasswordInput` |
| E1-T8 | Frontend: `ProtectedRoute` theo vai trò + menu Sider hiển thị theo vai trò | P0 | 2,0 | E1-T7 | frontend | | Học viên không thấy menu quản trị; truy cập URL không đúng vai trò bị chuyển hướng; `config/sider-options` là nguồn duy nhất của menu |
| E1-T9 | Unit test `AuthService` + `RolesGuard` (hash, xác thực, rotation, vai trò) | P1 | 2,0 | E1-T3 | backend | | `npm test` có ≥ 8 spec cho auth, coverage module auth ≥ 60%, chạy trong CI |

**DoD cấp epic E1:** mọi endpoint (trừ danh sách public đã ghi) yêu cầu token; 3 vai trò đăng nhập
được; có ít nhất 1 test tự động chứng minh học viên A không đọc được dữ liệu học viên B.

> ### Trạng thái E1 — chốt ngày 2026-10-03
>
> **Đã xong:** E1-T1, E1-T2, E1-T3, E1-T4, E1-T5, E1-T6, E1-T7, E1-T8.
> Bằng chứng backend (chạy trên API thật, không phải đọc code): **93 kiểm chứng end-to-end** đều đạt —
> 47 (đăng ký/đăng nhập/IDOR/RBAC/trạng thái tài khoản/xoay token/logout/quên mật khẩu) + 19 (rotation
> liên tiếp, phát hiện dùng lại token, các kiểu token sai) + 27 (đặt lại/đổi mật khẩu, token hết hạn,
> khoá tạm sau 10 lần sai, hash bcrypt cost 10, không rò mật khẩu ra DB/response). Migration
> `1791017471553-AddPasswordResetTokens` chạy `up → down → up` sạch, `schema:log` rỗng; `lint:ci` và
> `build` xanh; tài khoản demo trong seed vẫn đăng nhập được.
>
> **Quyết định đã chốt (2026-10-03):** băm mật khẩu bằng **`bcryptjs`, cost 10** (thuần JS, không cần
> build native trên Windows; khớp hash mật khẩu demo trong seed). Refresh token là **JWT** mang thêm
> `type='refresh'`, `familyId`, `jti` và dùng chung `JWT_SECRET` (§5.1) — không thêm biến môi trường
> mới. Frontend dùng **Redux Toolkit + localStorage** (đúng wireframes.md và dependency đã cài).
> Chống dò mật khẩu ở E1 chỉ làm **khoá theo tài khoản** (`failed_login_count`/`locked_until`,
> 10 lần/15 phút); **rate limit theo IP (`429`) hoãn sang E13-T4**. DB giữ tập
> `pending | active | suspended | disabled`; chữ "locked" trong E1-T5 được hiểu là *nhóm không đăng
> nhập được* (`suspended`/`disabled`, hoặc đang bị khoá tạm) và mỗi trường hợp có message riêng —
> **không** đổi CHECK constraint (đã sửa lại câu chữ ở `api-specification.md` §5.2 để khớp).
>
> **Chưa làm — có chủ đích:** **E1-T9 (unit test `AuthService`/`RolesGuard`) và phần e2e của E1-T6
> hoãn** theo chốt "không cần test ở giai đoạn này", nên DoD cấp epic ở trên **chưa đạt** mục "có ít
> nhất 1 test tự động chứng minh học viên A không đọc được dữ liệu học viên B" — hành vi đó **đã được
> kiểm chứng thủ công** (học viên gọi `GET /api/users/:id` của người khác → `403`, admin → `200`,
> giảng viên → `403`), sẽ chuyển thành test ở E13-T1/E13-T4.
>
> **Lệch nhỏ so với plan:** E1-T6 được kiểm chứng bằng một endpoint tối thiểu
> `GET /api/users/:id` (chính chủ hoặc admin) vì tới hết E1 chưa có tài nguyên nghiệp vụ nào; phạm vi
> "assigned" của giảng viên sẽ làm cùng `CourseModule` (E3). `POST /api/auth/change-password` (§5.3)
> làm luôn ở E1 để E2-T1/E2-T4 tái sử dụng. `PATCH /api/users/:id/status` (admin) được thêm để đạt DoD
> E1-T5 ("admin đổi trạng thái được") và khi khoá tài khoản thì **thu hồi mọi phiên ngay**.
>
> **Ba lỗi thật phát hiện khi kiểm thử (đã sửa, đã ghi chú trong code):**
> 1. xoay refresh token hai lần trong cùng một giây sinh ra chuỗi JWT giống nhau ⇒ vi phạm UNIQUE
>    `refresh_tokens.token_hash` (thiếu claim `jti`) — lần refresh thứ hai trả `500`;
> 2. `logout` một phiên làm **chết mọi phiên** còn lại, vì token đã thu hồi bị coi là "dùng lại token
>    bị đánh cắp" — nay chỉ coi là dấu hiệu đánh cắp khi `revoked_reason = 'rotated'`;
> 3. tài khoản đang bị **khoá tạm vẫn `refresh` được** (chỉ kiểm tra `status`, mà khoá tạm không đổi
>    `status`) ⇒ nay `assertAccountUsable()` kiểm tra cả `locked_until` ở mọi cửa vào (login, refresh,
>    `JwtStrategy`).

---

### E2 — Người dùng & hồ sơ

**Mục tiêu:** hồ sơ người dùng, quản lý người dùng ở mức admin, và phạm vi dữ liệu giảng viên
(giảng viên chỉ thấy học viên thuộc khoá mình phụ trách).

**Ánh xạ yêu cầu:** proposal §3.1 "user profile", "account status management"; user story Admin.

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E2-T1 | `UserModule`: `GET/PATCH /api/users/me`, đổi mật khẩu (yêu cầu mật khẩu cũ) | P0 | 2,0 | E1-T3 | backend | | Không thể đổi `role` qua endpoint hồ sơ (bị `whitelist` loại bỏ); đổi mật khẩu sai mật khẩu cũ → 400 kèm message tiếng Việt |
| E2-T2 | Admin quản lý người dùng: danh sách + lọc + phân trang, đổi vai trò, khoá/mở | P1 | 2,5 | E2-T1 | backend | | Chỉ `admin` gọi được; thao tác đổi vai trò sinh bản ghi audit (E12-T1) khi task đó xong; không cho admin tự hạ vai trò chính mình |
| E2-T3 | Lớp/nhóm (`class_groups`, `class_members`) phục vụ phạm vi dữ liệu giảng viên → **đã chuyển sang E3** | P0 | 2,5 | E1-T3 | db | | Giảng viên gọi API analytics chỉ nhận dữ liệu học viên trong lớp/khoá mình phụ trách (`WHERE` được kiểm chứng bằng e2e). **Chuyển sang E3 (chốt 2026-10-03)** vì `database-design.md` §3.2.4 định nghĩa `cohorts` có FK `course_id → courses`, mà `courses` chỉ ra đời ở E3-T1 |
| E2-T4 | Frontend: trang hồ sơ cá nhân (xem, sửa, đổi mật khẩu, thông tin vai trò) | P1 | 2,0 | E2-T1, E1-T7 | frontend | | Sửa hồ sơ → reload vẫn thấy dữ liệu mới; hiển thị lỗi bằng `ErrorBadge`/`FormItem` |
| E2-T5 | Frontend: trang quản lý người dùng cho admin (`ITable` + filter + modal đổi vai trò/khoá) | P1 | 3,0 | E2-T2, E2-T4 | frontend | | Dùng `ITable` (không viết `<table>` tay); phân trang và lọc gọi API thật; hành động nguy hiểm có xác nhận |
| E2-T6 | Test: RBAC người dùng — học viên không đọc/sửa hồ sơ người khác, không tự đổi vai trò → **hoãn sang E13-T4** | P1 | 1,5 | E2-T2 | backend | | ≥ 5 test case, có ít nhất 1 case khẳng định học viên nhận 403 khi `PATCH /api/users/:id` người khác. **Hoãn sang E13-T4 (chốt 2026-10-03)**, cùng chỗ với E1-T9 và e2e E1-T6 |

**DoD cấp epic E2:** vai trò và phạm vi dữ liệu được thực thi ở **tầng service**, không chỉ ở UI;
có test chứng minh.

> ### Trạng thái E2 — chốt ngày 2026-10-03
>
> **Đã xong:** E2-T1, E2-T2 (backend, đã kiểm chứng) và E2-T4, E2-T5 (frontend).
>
> Bằng chứng backend — **81 kiểm chứng end-to-end trên API thật** (không phải đọc code), tất cả đạt:
>
> - **26 kiểm chứng hồ sơ cá nhân (E2-T1):** đọc/sửa hồ sơ, `fullName` được trim, gửi `null` để xoá
>   `phone`; `phone` sai định dạng / `fullName` 1 ký tự / `bio` 1001 ký tự → `400` kèm **message tiếng
>   Việt**; PATCH kèm `role`/`status`/`email` **không** gây lỗi nhưng bị `whitelist` loại bỏ — kiểm tra
>   tận DB: `role` vẫn `student`, `status` vẫn `active`, email không đổi, phiên hiện tại vẫn dùng được;
>   bản ghi được ghi thật vào DB (không chỉ echo ở response); hồi quy IDOR của E1 vẫn đúng (học viên đọc
>   hồ sơ admin → `403`).
> - **32 kiểm chứng danh sách người dùng (E2-T2):** `meta` đủ 6 trường; `take=5` cho **5 dòng** nhưng
>   `itemCount` là **tổng số bản ghi** và `pageCount = max(1, ceil(tổng/5))`; tìm không ra ai →
>   `itemCount=0` và `pageCount=1`; trang 1 và trang 2 **không trùng** bản ghi; trang vượt phạm vi trả
>   mảng rỗng nhưng meta vẫn đúng (`hasNextPage=false`); `take=101`, `page=0`, `take=abc`, `order=sideways`, `role=root`,
>   `status=locked`, `sortBy=passwordHash` → `400`; thiếu token → `401`, học viên → `403`; `search`
>   không phân biệt hoa/thường (`ADMIN` = `admin`) và tìm được theo `studentCode`; lọc `role`/`status`
>   kết hợp trả đúng tập; `order=asc` và `desc` là hai thứ tự đảo nhau; cùng truy vấn hai lần cho cùng
>   thứ tự; bản ghi `deleted_at` không xuất hiện trong danh sách và `GET /users/:id` của nó → `404`.
> - **15 kiểm chứng đổi vai trò:** học viên gọi → `403`; admin đổi được và response trả vai trò mới;
>   access token **cũ** thấy vai trò mới **ngay** (`JwtStrategy` đọc `role` từ DB, không tin claim);
>   refresh token cũ **bị thu hồi** (`401`); đổi vai trò trùng giá trị cũ **không** thu hồi phiên
>   (idempotent); admin tự hạ vai trò mình → `400` kèm message tiếng Việt; `role` ngoài union → `400`;
>   `:id` không phải UUID → `400`; người dùng không tồn tại → `404`.
> - **8 kiểm chứng cho bản vá E1** ở dưới ("Lệch nhỏ" mục 1).
>
> **Bằng chứng frontend (E2-T4/T5):** `npm run lint` sạch, `npm run build` xanh — `/profile` và
> `/admin/users` được tách chunk riêng (7,45 kB và 41,2 kB), cảnh báo >500 kB là có sẵn từ trước. Một
> harness tạm (đã xoá) gọi thẳng tầng `@/apis/*` vào backend thật cho **25/25 kiểm chứng**: `getUsers`
> `take=5` → `itemCount=35`, `pageCount=7`; `search=giangvien` + `role=teacher` → đúng 2 giảng viên;
> `page=0`/`take=101` → `400`; học viên gọi `getUsers` → `403`; `updateMyProfile` đổi cả 4 trường và
> **đọc lại thấy giá trị mới** (DoD "F5 vẫn thấy" ở tầng API); gửi kèm `role`/`status`/`email` bị bỏ qua;
> gửi `null` xoá được `phone`/`major`/`bio`; tự hạ vai trò và tự khoá → `400` đúng message tiếng Việt;
> `changePassword` sai mật khẩu cũ → `400`; và sau khi đổi mật khẩu, `POST /auth/logout` vẫn trả `200`
> nên luồng `logout()` + `navigate('/login')` của trang hồ sơ chạy sạch (không rơi vào interceptor 401).
>
> **Chưa kiểm chứng được:** **chưa bấm thử trên trình duyệt** (không bật dev server theo yêu cầu). Riêng
> yêu cầu "lưu hồ sơ xong Header đổi tên ngay, không cần F5" mới chỉ được chứng minh bằng **đường code**
> (dispatch `updateUser` + `setStoredSession`) và ở **tầng API**; cần một lần click-through thật khi có
> người ngồi trước máy — ghi vào danh sách việc của E13-T6 (usability test).
>
> **Lỗi hợp đồng giữa hai tầng, phát hiện khi ghép FE (đã sửa):** bản cài đặt đầu tiên hiểu
> `meta.itemCount` là *số dòng của trang hiện tại*, vì mọi **ví dụ JSON** trong `api-specification.md`
> đều ghi `"itemCount":1` (chúng minh hoạ danh sách một phần tử). Nhưng **định nghĩa** ở §3.4 và ghi chú
> §12 ("`ITable` nhận `itemCount` cho phân trang server-side") nói `itemCount` là **tổng số bản ghi khớp
> điều kiện**, và `ITable` truyền thẳng giá trị đó vào `pagination.total` của antd. Với cách hiểu sai,
> bảng quản trị người dùng chỉ hiện **một trang** và không cách nào lật sang trang 2 (35 người dùng,
> 20 dòng/trang). Nay `buildPageMeta` trả `itemCount = tổng` và `pageCount = max(1, ceil(itemCount/take))`
> đúng §3.4; đã thêm 3 kiểm chứng khoá hành vi này (B6, B7, B11b) và ghi lại cạm bẫy trong tài liệu để
> module danh sách sau (E3 trở đi) không lặp lại.
>
> **Không cần migration:** E2 chỉ đọc/ghi trên các cột `users` đã có ở baseline — `schema:log` vẫn rỗng
> sau khi làm xong, DB còn 27 bảng.
>
> **Quyết định đã chốt (2026-10-03):** (1) **E2-T3 chuyển sang E3** — `database-design.md` §3.2.4 định
> nghĩa `cohorts` có FK `course_id → courses`, mà `courses` chỉ ra đời ở E3-T1; tạo trước sẽ phải để
> `course_id` nullable rồi sửa lại bằng migration thứ hai, hoặc sinh hai khái niệm lớp song song. (2)
> **E2-T6 hoãn sang E13-T4**, cùng chỗ với E1-T9 và e2e E1-T6 (nhất quán với chốt "không cần test ở giai
> đoạn này"). (3) **Sai mật khẩu cũ trả `400`** cho khớp DoD E2-T1 thay vì `401` của E1 — ngoài ngữ nghĩa,
> `401` còn khiến interceptor FE xoay refresh token vô ích mỗi lần gõ nhầm. (4) **Bỏ qua** các endpoint
> api-spec có nhưng không thuộc task E2: `POST /api/users`, `DELETE /api/users/:id`, avatar, và khối
> `summary` trong hồ sơ (cần `enrollments`/`submissions` của E4/E5).
>
> **Chưa làm — có chủ đích:** E2-T3 (→ E3) và E2-T6 (→ E13-T4). Vì vậy **DoD cấp epic E2 mới đạt một
> nửa**: "vai trò thực thi ở tầng service" ✅ (RBAC do `RolesGuard` + service quyết định, đã kiểm chứng),
> nhưng "phạm vi dữ liệu giảng viên" ⏳ (E3) và "có test chứng minh" ⏳ (E13-T4) thì chưa.
>
> **Lệch nhỏ so với plan:** 1. `POST /api/auth/change-password` sửa từ `401` sang `400` khi sai mật khẩu
> cũ (đụng vào code E1, đã cập nhật `api-specification.md` §5.2). 2. `GET /api/users/:id` nay trả **hồ sơ
> đầy đủ** (`UserDetail`: thêm `phone`, `major`, `bio`, `studentCode`, `dateOfBirth`) cho chính chủ hoặc
> admin — E1 chỉ trả 8 trường vì khi đó chưa có E2-T1. 3. `PATCH /api/users/:id/role` **thu hồi mọi phiên**
> khi vai trò đổi thật (đổi vai trò không đổi thì không), để trình duyệt buộc đăng nhập lại và lấy đúng
> vai trò cho menu/route — quyền trên API thì đã có hiệu lực ngay mà không cần thu hồi. 4. Đổi mật khẩu
> xong, FE phải xoá phiên và đưa về `/login` (server đã thu hồi toàn bộ refresh token).

---

### E3 — Khoá học & nội dung

**Mục tiêu:** thay toàn bộ mock bằng dữ liệu thật; có cấu trúc khoá → chương → bài học; giảng viên
soạn và publish nội dung; học viên duyệt catalog, tìm kiếm, xem bài học.

> **E3 nhận thêm E2-T3 (chốt 2026-10-03):** tạo `cohorts` + thành viên lớp để giới hạn phạm vi dữ liệu
> giảng viên. Bảng `cohorts` (E3-T1 là mốc phụ thuộc) có FK `course_id → courses`, nên phải làm **sau**
> khi `courses` tồn tại; đây cũng là nơi `course_instructors` xác định "khoá mình phụ trách".

**Ánh xạ yêu cầu:** proposal §3.1 "Courses and content"; user story Student ("search for and enroll"),
Instructor ("create courses and structure content by chapter/lesson"); architecture.md §4
`CourseModule`, `LessonModule`.

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E3-T1 | `CourseModule`: entity + CRUD + publish/unpublish + gán giảng viên | P0 | 3,0 | E0-T5, E1-T3 | backend | | Chỉ `teacher`/`admin` tạo/sửa; `unpublish` làm khoá biến mất khỏi catalog học viên nhưng dữ liệu enrollment còn nguyên |
| E3-T2 | `LessonModule`: entity + CRUD + `order_index` + nội dung TipTap (HTML) + chương | P0 | 3,5 | E3-T1 | backend | | Sắp xếp lại bài học giữ nguyên tính tuần tự; xoá bài học không mất submission đã có (soft constraint hoặc chặn kèm message) |
| E3-T3 | Danh mục (`categories`) + API tìm kiếm / lọc / phân trang cho catalog | P0 | 2,5 | E3-T1 | backend | | `GET /api/courses?search=&category=&page=&limit=` trả đúng envelope + metadata phân trang; chỉ trả khoá `published` cho học viên |
| E3-T4 | Upload tài liệu (slide/video) + lưu trữ + giới hạn định dạng & kích thước | P1 | 2,5 | E3-T2 | backend | | File vượt giới hạn bị từ chối kèm message rõ; đường dẫn file không cho phép path traversal; file không nằm trong git |
| E3-T5 | Điều kiện tiên quyết (`prerequisites`) + syllabus | P2 | 1,5 | E3-T1 | backend | | Khoá có tiên quyết chưa đạt → API trả cờ `eligible: false` + lý do; catalog hiển thị được |
| E3-T6 | Frontend: catalog khoá học thật (search, lọc, phân trang) — **thay `src/mocks/course.ts`** | P0 | 3,5 | E3-T3, E0-T12 | frontend | | Không còn import nào từ `src/mocks/course.ts` ở trang catalog; dùng `ITable`/card theo design system; search có debounce (`useDebounce` sẵn có) |
| E3-T7 | Frontend: chi tiết khoá học + syllabus + nút đăng ký | P1 | 3,0 | E3-T6 | frontend | | Hiển thị giảng viên, mô tả, danh sách chương/bài; nút đăng ký gọi API thật và phản ánh trạng thái đã đăng ký |
| E3-T8 | Frontend: trình xem nội dung bài học (danh sách bài + render TipTap + video) | P0 | 3,5 | E3-T2, E3-T6 | frontend | | Điều hướng bài trước/sau; nội dung HTML hiển thị đúng (đã sanitize); video phát được; **thay mock ở `/courses/:courseId`** |
| E3-T9 | Frontend: giảng viên soạn khoá học/bài học (TipTap + upload + publish) | P1 | 4,0 | E3-T4, E3-T8 | frontend | | Dùng `RichTextEditor` sẵn có; publish → học viên thấy ngay; draft không lộ ra catalog |
| E3-T10 | Test: quyền nội dung (học viên không sửa được; draft không hiển thị; giảng viên khác không sửa được khoá người khác) | P0 | 1,5 | E3-T2 | backend | | ≥ 5 e2e case khẳng định hành vi trên |

> **Quyết định đã chốt (2026-10-03) — đọc trước khi làm E3:** bốn mâu thuẫn thật giữa
> `database-design.md` (schema) và `api-specification.md` (ví dụ JSON) đã được xử lý, cộng thêm
> phạm vi frontend:
>
> 1. **Tên field: `database-design.md` thắng.** API trả `title`/`summary`/`owner`/`coverUrl`/`level`/
>    `visibility`… và query `ownerId`; **không** có `name`/`teacherId`/`thumbnailUrl`. Sửa lại ví dụ
>    JSON trong `api-specification.md` (rẻ hơn nhiều so với migration đổi cột trên schema đã áp dụng).
> 2. **Nội dung bài học: `database-design.md` thắng.** `lessons` chỉ có `content` + `content_format`;
>    video/slide/tệp nằm ở `lesson_materials` (§7.7). API trả `materials[]` và một field **suy diễn**
>    `derivedType` cho giao diện; **không** thêm cột `type`/`video_url`/`duration_seconds` vào `lessons`
>    (sẽ nhân đôi dữ liệu với `lesson_materials`).
> 3. **Tạo `course_instructors` + `cohorts` ngay ở E3** (đúng việc E2-T3 đã dời sang): migration riêng,
>    kèm FK `enrollments.cohort_id`. "Assigned" từ nay = `courses.owner_id = user.id` **hoặc** có dòng
>    `course_instructors`; mọi module nội dung đi qua **một** `CourseAccessService` thay vì tự viết điều
>    kiện. Phạm vi theo lớp (`cohort_id`) chỉ dùng từ E8 khi lọc dữ liệu học viên.
> 4. **Điều kiện tiên quyết có cấu trúc:** thêm bảng `course_prerequisites` (ngoài bản gốc
>    `database-design.md`, đã ghi thành §3.2.8). "Đã đạt" = có `enrollments.status = 'completed'` cho
>    khoá tiên quyết — bảng `enrollments` đã có từ baseline nên kiểm chứng được ngay ở E3. `eligible`
>    là `null` với `teacher`/`admin` vì họ không ghi danh.
> 5. **Frontend làm trọn E3-T6→T9**, và vì DoD của E3-T7 đòi "nút đăng ký gọi API thật" nên **kéo tối
>    thiểu `POST /api/enrollments` từ E4-T1** sang E3 (phần còn lại của E4-T1 — danh sách, huỷ, tiến độ
>    — vẫn thuộc E4).
>
> **Sai lệch có chủ đích so với `api-specification.md`** (đã ghi vào chính tài liệu đó): (a) catalog
> **yêu cầu đăng nhập**, không `@Public()` — vì §5.4 là danh sách route công khai đã chốt ở E1-T3 và
> không có khoá học trong đó; (b) `GET /api/courses/:id` **không** nhúng `sections` như ví dụ cũ, FE gọi
> thêm `sections`/`lessons` — tránh phụ thuộc vòng giữa `CourseModule` và `LessonModule`; (c) tham số
> phân trang là `take` (không phải `limit` như bảng task E3-T3 ghi) để đồng nhất với E2; (d) học liệu
> lưu trên **đĩa cục bộ** theo `UPLOAD_DIR` đã có sẵn trong `.env`, phục vụ tĩnh tại `/uploads/**` với
> `PUBLIC_BASE_URL` — đây là câu trả lời cho câu hỏi mở số 3 của `api-specification.md` §13.

**DoD cấp epic E3:** `mocks/course.ts` không còn được dùng ở bất kỳ route nào; toàn bộ nội dung đến từ API.

> **Trạng thái E3 — chốt ngày 2026-10-03 (đã làm xong, trừ phần test chuyển sang E13):**
>
> | Task | Trạng thái | Ghi chú |
> |---|---|---|
> | E3-T1 khoá học + publish + gán giảng viên | ✅ | `CourseModule`: categories/courses/instructors/cohorts/prerequisites; migration `1791022171040` tạo `cohorts` + `course_instructors` + `course_prerequisites` và FK `enrollments.cohort_id`; mọi kiểm tra quyền đi qua **một** `CourseAccessService` |
> | E3-T2 chương/bài học | ✅ | `LessonModule`: CRUD + `order_index` liên tục **toàn khoá** + `content` (HTML TipTap) + chặn xoá khi đã có bài nộp/tiến độ + đánh số lại sau khi xoá |
> | E3-T3 danh mục + catalog | ✅ | CRUD danh mục (admin), `GET /api/courses` có `search`/`categoryId`/`status`/`level`/`semester`/`ownerId` + phân trang có trần `take`, phạm vi theo vai trò áp **trước** bộ lọc của client |
> | E3-T4 upload học liệu | ✅ | `StorageService` toàn cục: tên tệp sinh bằng UUID, whitelist 9 MIME, `413`/`415`/`400`, chống traversal; phục vụ tĩnh `/uploads/**`; `backend/uploads` đã vào `.gitignore` (trước E3 `.env.example` nói đã ignore nhưng thực tế **chưa**) |
> | E3-T5 tiên quyết + điều kiện | ✅ | Bảng `course_prerequisites` (bổ sung §3.2.8 của `database-design.md`); "đã đạt" = `enrollments.status='completed'`; `eligible`/`reason` trả cho `student`, và **cùng** service đó chặn ở `POST /api/enrollments` |
> | E3-T6 catalog FE | ✅ | Trang `/` đọc API thật: `ITable` phân trang server, search debounce 400 ms, lọc danh mục/trình độ/trạng thái; bỏ tính năng giả thời mock (`starred`, `Segmented` trạng thái học viên) |
> | E3-T7 chi tiết + syllabus + đăng ký | ✅ | `/courses/:courseId`; trạng thái `loading`/`404`/`403`/đã ghi danh/thiếu tiên quyết; nút đăng ký gọi `POST /api/enrollments` thật |
> | E3-T8 trình xem bài học | ✅ | `/courses/:courseId/learn[/:lessonId]`; điều hướng bài trước/sau, video phát được, HTML **đã sanitize** bằng DOMPurify (`utils/html.ts`) trước khi `dangerouslySetInnerHTML` |
> | E3-T9 giảng viên soạn nội dung | ✅ | `/teacher/courses` + `/teacher/courses/:courseId` (5 tab: thông tin, tiên quyết, giảng viên, lớp, nội dung) dùng `RichTextEditor` + upload thật |
> | E3-T10 test quyền nội dung | ⏳ → E13-T4 | **Đã kiểm chứng bằng script e2e dùng một lần** (257 kiểm tra trên server thật, nhóm A có 13 kiểm tra quyền nội dung) nhưng **không** nằm trong repo; bộ test trong repo vẫn thuộc E13-T4 theo chốt "chưa cần test ở giai đoạn này" |
> | E2-T3 (dời sang E3) | ✅ | Bảng `cohorts` + phân công giảng viên theo lớp đã có, seed tạo 4 lớp và 4 dòng phân công (1 chủ sở hữu + 1 đồng giảng viên phụ trách `L01`) để E8 có dữ liệu kiểm thử phạm vi |
>
> **DoD cấp epic E3: đạt.** `frontend/src/mocks/` và `pages/course-content/` đã bị xoá; cả bốn màn
> hình nội dung (catalog, chi tiết, trình xem bài, khu soạn thảo) đọc API thật.
>
> **4 lỗi thật do kiểm thử đầu-cuối E3 phát hiện và đã sửa** (ghi lại vì đây là loại lỗi mà đọc code
> không thấy):
> 1. `GET /api/courses?sortBy=enrolledCount` trả **`500`** cho mọi request: subquery tương quan có
>    định danh trích dẫn bị TypeORM hiểu là alias chưa join. Đã chuyển sang bảng dẫn xuất 1-1
>    (`LEFT JOIN (… GROUP BY course_id)` + `addSelect` + `ORDER BY` theo alias).
> 2. Catalog của **giảng viên lộ khoá `private` của người khác** (danh sách trả về nhưng chi tiết `403`):
>    nhánh "đã publish" của phạm vi giảng viên thiếu `visibility <> 'private'`.
> 3. `PUT /api/courses/:id/prerequisites` với chính khoá học đó trả `200` + danh sách rỗng (bỏ qua im
>    lặng) thay vì `400`; nay từ chối tường minh.
> 4. **Admin tạo khoá học không được** khi bỏ trống giảng viên phụ trách, và FE không có ô chọn giảng
>    viên ⇒ admin không thể tạo khoá qua giao diện. Đã thêm thông điệp `400` riêng ở backend và ô chọn
>    giảng viên (chỉ admin) ở modal tạo khoá.

---

### E4 — Học tập & tiến độ

**Mục tiêu:** học viên đăng ký khoá, tiến độ được ghi nhận và hiển thị, có thể "tiếp tục học"
từ chỗ dừng.

**Ánh xạ yêu cầu:** proposal §3.1 "Course enrollment, progress tracking";
user story Student ("Progress is tracked via completed lessons and quizzes").

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E4-T1 | `enrollments`: đăng ký / huỷ / danh sách khoá đã đăng ký | P0 | 2,5 | E3-T1, E1-T3 | backend | | Đăng ký trùng trả lỗi nghiệp vụ rõ ràng (không tạo bản ghi thứ hai); huỷ đăng ký không xoá tiến độ đã ghi |
| E4-T2 | `lesson_progress` + tính % hoàn thành khoá | P0 | 2,5 | E4-T1, E3-T2 | backend | | Đánh dấu hoàn thành 2 lần không tăng %; % = số bài hoàn thành / tổng bài **đang published**; tính đúng khi có bài bị unpublish |
| E4-T3 | API "tiếp tục học" (resume): trả bài học gần nhất chưa hoàn thành | P1 | 1,5 | E4-T2 | backend | | Trả đúng bài đầu tiên của khoá khi chưa học gì; trả `null` + message khi đã hoàn thành hết |
| E4-T4 | Frontend: luồng đăng ký khoá + trang "khoá học của tôi" | P0 | 2,5 | E4-T1, E3-T6 | frontend | | Sau đăng ký, khoá xuất hiện ngay trong danh sách; hiển thị trạng thái đăng ký trên catalog |
| E4-T5 | Frontend: thanh tiến độ trong khoá + nút đánh dấu hoàn thành + nút "tiếp tục học" | P0 | 2,5 | E4-T2, E3-T8 | frontend | | % cập nhật ngay sau khi đánh dấu (optimistic hoặc refetch); nút resume điều hướng đúng bài |
| E4-T6 | Test: idempotency tiến độ và enrollment | P1 | 1,5 | E4-T2 | backend | | ≥ 4 test case (hoàn thành trùng, đăng ký trùng, huỷ rồi đăng ký lại, % biên 0 và 100) |

**DoD cấp epic E4:** một học viên có thể đi hết luồng đăng ký → học → đánh dấu hoàn thành → resume,
và % phản ánh đúng trạng thái trong DB.

---

### E5 — Quiz & chấm điểm

**Mục tiêu:** ngân hàng câu hỏi, làm bài có giới hạn thời gian, chấm điểm tự động, xem lại lỗi,
giảng viên phản hồi bài nộp.

**Ánh xạ yêu cầu:** proposal §3.1 "timed practice quizzes with automated grading, instructor feedback";
user story Student ("take practice quizzes"); Instructor ("build multiple-choice quizzes").

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E5-T1 | `quizzes`, `quiz_questions`, `quiz_options` + migration + CRUD ngân hàng câu hỏi (module NestJS: `ExerciseModule`) | P0 | 2,5 | E0-T5, E3-T2 | backend | | Câu hỏi 1 đáp án đúng và nhiều đáp án đúng đều dùng được; đáp án đúng **không** bị trả về API khi học viên đang làm bài |
| E5-T2 | `submissions` + chấm điểm tự động (điểm, `attempt_no`, `duration_seconds`) | P0 | 3,0 | E5-T1, E4-T1 | backend | | Chấm đúng với đề nhiều câu; `attempt_no` tăng đúng; thời lượng lưu đúng; client không thể gửi điểm lên |
| E5-T3 | Cấu hình quiz: thời lượng, số lần làm tối đa, trộn câu; phiên làm bài có hạn | P1 | 3,0 | E5-T2 | backend | | Nộp sau khi hết giờ bị từ chối (hoặc đánh dấu `expired` — chốt trong Q6); vượt số lần làm bị chặn |
| E5-T4 | API kết quả + xem lại lỗi theo từng câu | P0 | 2,0 | E5-T2 | backend | | Trả điểm, số câu đúng, và với mỗi câu: đáp án đã chọn, đáp án đúng, giải thích; **chỉ** sau khi đã nộp |
| E5-T5 | Phản hồi của giảng viên trên bài nộp | P1 | 2,0 | E5-T2 | backend | | Giảng viên chỉ phản hồi được bài nộp thuộc khoá mình phụ trách; học viên nhận thông báo (liên kết E11-T1) |
| E5-T6 | Frontend: làm bài thi (timer, điều hướng câu, autosave) | P0 | 4,5 | E5-T1, E3-T8 | frontend | | Timer đúng theo `expires_at` từ server (không tin đồng hồ client); không mất đáp án khi đổi câu; cảnh báo trước khi rời trang |
| E5-T7 | Frontend: trang kết quả + xem lại lỗi | P0 | 2,5 | E5-T4, E5-T6 | frontend | | Hiển thị điểm, số câu đúng/sai, tô màu đáp án; dùng component có sẵn (không viết tay pill trạng thái) |
| E5-T8 | Frontend: giảng viên — ngân hàng câu hỏi + tạo đề | P1 | 4,0 | E5-T1, E3-T9 | frontend | | Tạo được đề ≥ 10 câu qua UI; sửa/xoá câu hỏi có xác nhận; đề lưu vào DB đúng cấu trúc |
| E5-T9 | Test: chấm điểm biên (0 điểm, điểm tối đa, hết giờ, nộp trùng, câu bỏ trống) | P0 | 2,0 | E5-T2 | backend | | ≥ 6 test case, trong đó có 1 case khẳng định nộp trùng không tạo submission thứ hai cho cùng `attempt_no` |

**DoD cấp epic E5:** một học viên làm bài → điểm hiển thị → xem lại lỗi; dữ liệu điểm dùng được cho
feature store ở E8-T3.

---

### E6 — Thảo luận & kiểm duyệt

**Mục tiêu:** diễn đàn theo khoá/bài học và luồng xử lý báo cáo vi phạm của admin.
Đây là epic **có thể cắt đầu tiên** (không nằm trong đường găng, không cần cho tiêu chí demo §4.3).

**Ánh xạ yêu cầu:** proposal §3.1 "discussion forums"; user story Admin ("moderate content",
"content violation reports").

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E6-T1 | `discussion_threads`, `discussion_posts` + API (tạo, trả lời, sửa, xoá mềm) | P1 | 2,5 | E4-T1 | backend | | Chỉ người tạo sửa/xoá được bài của mình; giảng viên/admin xoá được mọi bài trong khoá mình phụ trách |
| E6-T2 | `content_reports` + API báo cáo và xử lý | P1 | 2,0 | E6-T1 | backend | | Báo cáo không hợp lệ (bài không tồn tại) bị từ chối; trạng thái `pending`/`resolved`/`rejected` dùng union type |
| E6-T3 | Frontend: diễn đàn theo bài học/khoá | P2 | 3,0 | E6-T1, E3-T8 | frontend | | Gửi bài mới hiện ngay; phân trang; nội dung dài không phá layout |
| E6-T4 | Frontend: kiểm duyệt — danh sách báo cáo + hành động | P2 | 2,5 | E6-T2, E1-T8 | frontend | | Chỉ admin/giảng viên thấy màn hình; sau khi ẩn bài, học viên không thấy nữa |
| E6-T5 | Test: quyền trên nội dung thảo luận + ẩn bài vi phạm | P1 | 1,5 | E6-T2 | backend | | ≥ 4 test case |

**DoD cấp epic E6:** (chỉ khi nhóm **không** cắt epic này) thảo luận và báo cáo vi phạm hoạt động
end-to-end và có test quyền.

---

### E7 — Telemetry hành vi (learning events)

**Mục tiêu:** thu thập sự kiện hành vi học tập **không làm chậm** trải nghiệm người học và đủ giàu
để tính feature cho model rủi ro. Đây là **nguồn dữ liệu cho toàn bộ Hướng 5**.

**Ánh xạ yêu cầu:** proposal §3.1 "learning behavior telemetry (completion time, attempt counts)";
§4.1 "Data Tracking and Stream Processing"; §4.2 "Data Ingestion Integration";
architecture.md §4 `LearningActivityModule`, §7 (danh sách feature).

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E7-T1 | Schema `learning_events` (`event_type` union type, `occurred_at`, `duration_seconds`, `metadata jsonb`, `user_id`, `course_id`, `lesson_id`) + index tối ưu truy vấn theo thời gian | P0 | 2,5 | E0-T5, E4-T1 | db | | ≥ 6 `event_type` được định nghĩa bằng union type (không dùng TS `enum`); `EXPLAIN` cho truy vấn "event trong 14 ngày gần nhất của 1 học viên" dùng `idx_learning_events_user_time (user_id, occurred_at DESC)`, không seq scan trên dữ liệu seed |
| E7-T2 | `LearningActivityModule`: endpoint ghi event + validate payload + rate limit chống spam | P0 | 3,0 | E7-T1, E1-T6 | backend | | Payload sai schema bị từ chối; vượt rate limit trả 429; học viên không ghi được event cho học viên khác |
| E7-T3 | Ghi event bất đồng bộ (buffer/queue nội bộ) để không chặn UX | P1 | 3,0 | E7-T2 | backend | | Đo được: p95 latency thao tác học **không tăng quá 10%** khi bật tracking; khi DB lỗi, request học vẫn thành công và có log cảnh báo |
| E7-T4 | Frontend: hook `useTrackEvent` + gắn event vào page view, bắt đầu/kết thúc bài học, nộp quiz | P0 | 3,0 | E7-T2, E3-T8 | frontend | | ≥ 5 loại event được gửi từ UI; không gửi trùng khi re-render; lỗi tracking không hiện lỗi cho người dùng |
| E7-T5 | Định nghĩa "session" và tính thời gian on-task (Page Visibility API) | P1 | 2,0 | E7-T4 | frontend | | Đóng tab khi đang học vẫn ghi được `duration_seconds` hợp lý; session không kéo dài vô hạn khi tab treo |
| E7-T6 | Test: event đúng schema, không chặn request chính, chống ghi trùng | P0 | 2,0 | E7-T3 | backend | | ≥ 5 test case + 1 phép đo latency được ghi vào báo cáo test (E13) |

**DoD cấp epic E7:** có dữ liệu hành vi thật trong `learning_events` từ luồng học thật (không phải
chỉ từ seed), và việc ghi event không làm hỏng trải nghiệm học.

---

### E8 — Analytics dashboard

**Mục tiêu:** biến dữ liệu thô thành thông tin cho giảng viên: xu hướng theo thời gian, so sánh
cohort, và **feature store** làm đầu vào cho model rủi ro. Đây là epic chứa **tiêu chí demo §4.3 (1)**.

**Ánh xạ yêu cầu:** proposal §3.1 "instructor analytics dashboard"; §4.3 (real-time update & visualize
trên dashboard); user story Instructor ("monitor progress, assessment results, and learning behavior");
architecture.md §4 `AnalyticsModule`; §7 (feature list).

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E8-T1 | `AnalyticsModule`: aggregation queries (tiến độ trung bình, phân bố điểm, hoạt động theo ngày) | P0 | 3,5 | E7-T1, E5-T2, E4-T2 | backend | | 3 endpoint trả số liệu đúng khi đối chiếu thủ công với SQL trên seed; dùng QueryBuilder/raw SQL có tham số hoá (không nối chuỗi) |
| E8-T2 | Materialized view + job refresh (theo lịch) cho các bảng tổng hợp nặng | P1 | 3,0 | E8-T1 | db | | Refresh chạy theo lịch; endpoint dashboard đọc từ view; có script refresh thủ công cho ngày demo |
| E8-T3 | **Tính feature** cho pipeline rủi ro (`recency`, `completion_rate`, `avg_score`, `score_trend`, `attempt_anomaly`, `on_task_time`) theo `(user_id, course_id, tuần)` | P0 | 4,0 | E8-T1 | backend | | Mỗi feature có công thức viết trong `03-architecture/analytics-ai-design.md` §3; tính lại trên dữ liệu seed cho ra giá trị khớp với tính tay trên ≥ 3 học viên mẫu; lưu kết quả vào `risk_predictions.feature_snapshot` (JSONB) + `risk_feature_contributions` theo `02-specs/database-design.md` §3.4; **không** tạo bảng feature riêng (xem Q12) |
| E8-T4 | API dashboard giảng viên (tổng quan, xu hướng, so sánh cohort) + **phân quyền theo lớp/khoá** | P0 | 3,5 | E8-T1, E2-T3 | backend | | Giảng viên A không thấy số liệu lớp giảng viên B (e2e khẳng định); admin thấy toàn hệ thống |
| E8-T5 | Cache Redis cho endpoint dashboard + ETag/invalidations | P1 | 2,0 | E8-T4 | backend | | Lần gọi thứ hai nhanh hơn rõ rệt và ghi lại số đo; cache được xoá khi có dữ liệu mới đủ ngưỡng |
| E8-T6 | Frontend: dashboard giảng viên (biểu đồ antd/Charts, lọc theo lớp/khoá/khoảng thời gian) | P0 | 5,0 | E8-T4, E0-T12 | frontend | | Biểu đồ render từ API thật; đổi filter cập nhật số liệu; trạng thái loading/empty/error đều có |
| E8-T7 | Frontend: trang chi tiết học viên (drill-down từ dashboard) | P1 | 3,0 | E8-T6 | frontend | | Đi từ bảng cohort → chi tiết 1 học viên; hiển thị tiến độ, điểm, hoạt động gần đây |
| E8-T8 | Test hiệu năng dashboard trên dữ liệu mô phỏng (**mục tiêu đề xuất: p95 < 500 ms**) | P0 | 2,0 | E8-T6 | backend | | Có báo cáo số đo p50/p95 trên tập dữ liệu mô phỏng (quy mô ghi rõ); nếu vượt mục tiêu thì có kết luận + hành động |

**DoD cấp epic E8:** giảng viên mở dashboard và thấy số liệu **thay đổi khi có hoạt động học mới**
(điều kiện cho tiêu chí demo §4.3).

---

### E9 — AI service + pipeline dự đoán rủi ro

**Mục tiêu:** service FastAPI tách rời, hàng đợi BullMQ, và pipeline biến feature thành
`risk_score` / `risk_level` **kèm giải thích feature**. Đây là **năng lực lõi của Hướng 5** và chứa
tiêu chí demo §4.3 (2).

**Ánh xạ yêu cầu:** proposal §3.1 "Automated risk detection pipeline (FastAPI)";
§4.1, §4.2 (Processing Integration); §4.3 (classification + explainability);
architecture.md §2, §3.3, §4 (`AIGatewayModule`), §7 (input/output của model), §8 (bảo mật service).

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E9-T1 | Scaffold FastAPI service (`ai-service/`): health, cấu hình, xác thực nội bộ bằng API key, không bind ra ngoài localhost | P0 | 2,0 | E0-T2 | ai | | `GET /health` trả OK; gọi không có API key → 401; service chỉ listen trên interface nội bộ (kiểm chứng bằng cấu hình + ghi chú trong README) |
| E9-T2 | **Rule-based v0**: ngưỡng trên feature → `risk_score` (0–1) + `risk_level` (low/medium/high) | P0 | 3,0 | E9-T1, E8-T3 | ai | | Chạy được trên feature thật của seed; ngưỡng đọc từ cấu hình (không hardcode); kết quả tái lập được với cùng input |
| E9-T3 | Model ML v1 (Logistic Regression → cân nhắc XGBoost) + script train/eval | P1 | 5,0 | E9-T4 | ai | | Có script train chạy lại được từ dữ liệu mô phỏng; model version được ghi lại; kết quả **không** được ghi là "tốt" nếu chưa đo |
| E9-T4 | Sinh dữ liệu mô phỏng theo kịch bản hành vi (chăm chỉ / giảm dần / bỏ học / học dồn) + nhãn ground-truth | P0 | 4,0 | E8-T3 | ai | | ≥ 100 học viên mô phỏng, ≥ 4 kịch bản, mỗi kịch bản có nhãn; script tái lập được (seed cố định) và dữ liệu ghi vào DB hoặc file có version |
| E9-T5 | Đánh giá model: precision/recall/F1, confusion matrix, so sánh với baseline rule-based | P1 | 3,0 | E9-T3 | ai | | Có bảng số liệu thật (đo được) trong báo cáo cuối; **không** dùng số liệu minh hoạ giả |
| E9-T6 | Giải thích: feature contribution (SHAP nếu kịp, hoặc rule-matched) → JSON giải thích | P0 | 3,0 | E9-T2 | ai | | Mỗi dự đoán có ≥ 2 lý do kèm giá trị feature; lý do viết bằng tiếng Việt ở tầng hiển thị, dữ liệu thô giữ tiếng Anh |
| E9-T7 | Redis + BullMQ trong NestJS: queue `ai.risk.predict`, worker, retry/backoff, dead-letter | P0 | 4,0 | E0-T2 | backend | | Job được đẩy và xử lý bất đồng bộ; job lỗi được retry theo cấu hình rồi chuyển DLQ; không chặn request HTTP |
| E9-T8 | `AIGatewayModule`: tạo `ai_jobs`, dispatch, nhận kết quả (poll/callback), timeout, circuit breaker | P0 | 4,0 | E9-T1, E9-T7 | backend | | Trạng thái job (`pending`/`running`/`succeeded`/`failed`) truy vấn được qua API; AI service tắt → request học vẫn OK, job chuyển `failed` sau timeout |
| E9-T9 | Bảng `risk_predictions` + `model_versions`: lưu kết quả, feature contribution, phiên bản model | P0 | 2,5 | E9-T6, E9-T8 | db | | Mỗi dự đoán gắn `model_version`; lịch sử dự đoán của 1 học viên truy vấn được theo thời gian |
| E9-T10 | Cron định kỳ chạy dự đoán cho toàn bộ enrollment đang hoạt động | P1 | 2,0 | E9-T8, E9-T9 | backend | | Job chạy theo lịch cấu hình được; chạy lại không tạo dự đoán trùng trong cùng kỳ; có log số lượng học viên đã xử lý |
| E9-T11 | Đóng gói môi trường dev: Docker Compose (Redis + AI service) hoặc script Windows tương đương | P0 | 2,0 | E9-T1 | devops | | Một lệnh duy nhất dựng Redis + AI service trên máy Windows; README ghi rõ biến môi trường cần thiết |
| E9-T12 | Test pipeline trên **dữ liệu mẫu cố định** (golden file): feature tính đúng, risk level đúng kỳ vọng | P1 | 3,0 | E9-T4, E9-T6 | ai | | Có bộ input cố định + output kỳ vọng trong repo; test đỏ khi cố tình đổi ngưỡng hoặc công thức feature |

**DoD cấp epic E9:** một học viên mô phỏng nhận được `risk_level` + giải thích **được lưu trong DB**,
sinh ra từ pipeline chạy tự động, không cần thao tác tay khi demo.

---

### E10 — Giải thích & can thiệp

**Mục tiêu:** biến dự đoán thành **hành động**: giảng viên thấy ai rủi ro, vì sao, và gửi can thiệp;
hệ thống tự động chạy luồng can thiệp. Đây là **tiêu chí demo §4.3 (3)**.

**Ánh xạ yêu cầu:** proposal §3.1 "feature-level risk explainability, in-app intervention messaging";
§4.2 (UI and Action Integration); user story Instructor ("send direct intervention messages");
architecture.md §4 `InterventionModule`.

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E10-T1 | `interventions`: schema + API tạo/theo dõi can thiệp | P0 | 2,5 | E9-T9 | backend | | Mỗi can thiệp gắn `user_id`, `course_id`, người tạo, kênh, nội dung, trạng thái; giảng viên chỉ tạo được cho học viên thuộc khoá mình |
| E10-T2 | Mapping feature → khuyến nghị ôn tập (ví dụ recency cao → nhắc quay lại; avg_score thấp ở kỹ năng X → gợi ý bài Y) | P0 | 2,5 | E9-T6 | ai | | Mỗi `risk_level` medium/high có ≥ 2 khuyến nghị tương ứng; mapping nằm trong cấu hình, không hardcode rải rác |
| E10-T3 | Frontend: danh sách học viên at-risk + **giải thích mức feature** | P0 | 3,5 | E9-T9, E8-T6 | frontend | | Mỗi dòng có risk level, risk score, và lý do hiển thị bằng tiếng Việt; sắp xếp được theo mức rủi ro |
| E10-T4 | Frontend: form/nút gửi can thiệp tới học viên | P0 | 3,0 | E10-T1, E10-T3 | frontend | | Gửi xong trạng thái đổi ngay; học viên nhận được thông báo in-app; có xác nhận trước khi gửi |
| E10-T5 | Theo dõi hiệu quả can thiệp (đóng/mở, so sánh trước–sau) | P2 | 2,5 | E10-T4, E8-T3 | backend | | Có endpoint trả về thay đổi feature của học viên trong N ngày sau can thiệp; ghi rõ đây là **chỉ số tham khảo**, không phải kết luận nhân quả |
| E10-T6 | Test e2e luồng can thiệp (flag → hiển thị → gửi → học viên nhận → ghi nhận) | P0 | 2,5 | E10-T4 | backend | | 1 kịch bản e2e chạy tự động qua toàn bộ chuỗi; là bằng chứng cho tiêu chí demo §4.3 (3) |

**DoD cấp epic E10:** luồng can thiệp chạy **tự động** khi có cờ rủi ro, không cần thao tác thủ công
trên DB trong lúc demo.

---

### E11 — Thông báo

**Mục tiêu:** học viên nhận cảnh báo/nhắc nhở in-app (và email nếu kịp), không spam.

**Ánh xạ yêu cầu:** proposal §3.1 "in-app intervention messaging"; §4.2 "automatically dispatches
personalized in-app notifications or emails"; §4.3 (automated execution of intervention workflows);
architecture.md §4 `NotificationModule`.

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E11-T1 | `NotificationModule`: thông báo in-app (tạo, danh sách, đánh dấu đã đọc, số chưa đọc) | P0 | 2,5 | E1-T3 | backend | | Học viên chỉ đọc được thông báo của mình; số chưa đọc trả đúng; đánh dấu đã đọc idempotent |
| E11-T2 | Tự động phát thông báo khi risk chuyển lên medium/high (idempotent theo `prediction_id`) | P0 | 2,0 | E11-T1, E9-T9 | backend | | Chạy lại cùng một dự đoán **không** tạo thông báo thứ hai; có test khẳng định điều này |
| E11-T3 | Email (dev: MailHog/log; prod: SMTP qua biến môi trường) | P1 | 2,5 | E11-T1 | backend | | Bật/tắt bằng biến môi trường; tắt email thì hệ thống vẫn chạy; nội dung email tiếng Việt |
| E11-T4 | Chống spam: rate limit theo học viên/ngày + ngưỡng cấu hình được | P1 | 1,5 | E11-T2 | backend | | Vượt ngưỡng thì bỏ qua và ghi log; ngưỡng đổi được không cần build lại |
| E11-T5 | Frontend: chuông thông báo + danh sách + badge số chưa đọc | P1 | 2,5 | E11-T1, E1-T8 | frontend | | Badge cập nhật khi có thông báo mới (polling hoặc realtime — xem Q5); dùng component `Badge` sẵn có |
| E11-T6 | Test: không gửi trùng, không gửi ngoài quyền, tôn trọng rate limit | P1 | 1,5 | E11-T4 | backend | | ≥ 4 test case |

**DoD cấp epic E11:** học viên bị gắn cờ rủi ro **thấy thông báo trong ứng dụng** mà không cần giảng
viên thao tác tay (tiêu chí demo §4.3 (3)).

---

### E12 — Quản trị & audit

**Mục tiêu:** admin quản trị danh mục, ngưỡng cảnh báo và có **audit trail** cho mọi hành động quản trị.

**Ánh xạ yêu cầu:** proposal §3.1 "audit logs for administrative actions", "account status management";
user story Admin ("all actions and configuration changes logged in audit trails");
architecture.md §4 `AdminModule`, §8 (audit log cho intervention và risk_prediction).

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E12-T1 | `audit_logs`: schema + interceptor/decorator ghi hành động quản trị (ai, khi nào, đối tượng, giá trị trước/sau) | P0 | 3,0 | E1-T3 | backend | | ≥ 6 loại hành động được ghi; log bất biến (không có endpoint sửa/xoá); chỉ admin đọc được |
| E12-T2 | Cấu hình ngưỡng cảnh báo rủi ro (`risk_thresholds`) + versioning cấu hình | P1 | 2,5 | E12-T1, E9-T2 | backend | | Đổi ngưỡng có hiệu lực ở lần dự đoán kế tiếp (không cần restart); mỗi thay đổi sinh audit log + tăng version |
| E12-T3 | Frontend admin: quản lý danh mục khoá học + hàng đợi kiểm duyệt + xem audit trail | P2 | 3,0 | E12-T1, E6-T4 | frontend | | Chỉ admin truy cập; bảng audit lọc được theo người/thời gian/loại hành động |
| E12-T4 | Frontend admin: log job AI + phiên bản model + thống kê cơ bản (số enrollment, tỷ lệ hoàn thành) | P2 | 2,5 | E9-T9, E12-T3 | frontend | | Thấy được job failed và lý do; thấy `model_version` đang dùng |
| E12-T5 | Test: mọi thao tác quản trị đều sinh audit log | P1 | 1,5 | E12-T1 | backend | | ≥ 5 test case, mỗi case khẳng định có bản ghi audit tương ứng |

**DoD cấp epic E12:** không có hành động quản trị nào "âm thầm" — tất cả đều truy vết được.

---

### E13 — Kiểm thử chất lượng

**Mục tiêu:** chứng minh hệ thống chạy đúng, an toàn, chịu tải ở mức đồ án, và **đủ điều kiện demo**.

**Ánh xạ yêu cầu:** proposal §3.2 acceptance criteria (3 user story); §4.3 (Data Testing Plan
and Evaluation, Functional Acceptance Criteria); §6.1 tuần 47.

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E13-T1 | Unit test backend cho module nghiệp vụ chính (Auth, Course, Lesson, Quiz, Analytics) | P0 | 4,0 | E5-T2, E8-T4 | backend | | `npm test` xanh trong CI; coverage các module trên ≥ 60%; có báo cáo coverage đính kèm |
| E13-T2 | e2e API (supertest) cho 5 luồng chính: đăng nhập → catalog → học → quiz → dashboard | P0 | 4,0 | E5-T7, E8-T6 | backend | | 5 luồng chạy tự động trên DB test; là bằng chứng "walking skeleton" hoạt động |
| E13-T3 | Frontend test (Vitest + Testing Library — **đề xuất**) cho component/hook trọng yếu | P1 | 4,0 | E5-T6, E8-T6 | frontend | | ≥ 15 test (hook tracking, form auth, render dashboard với dữ liệu giả); chạy trong CI |
| E13-T4 | Kiểm thử bảo mật: RBAC, IDOR, auth bypass, rate limit, input validation | P0 | 3,0 | E1-T6, E11-T4 | backend | | Bảng kết quả test có kết luận Pass/Fail từng hạng mục; mọi Fail phải có issue và trạng thái fix. **Nơi nhận các test đã hoãn:** E1-T9 (unit `AuthService`/`RolesGuard`), e2e E1-T6 (IDOR), E2-T6 (RBAC người dùng), rate limit theo IP (`429`) của E1-T5 |
| E13-T5 | Kiểm thử hiệu năng (k6 hoặc autocannon) cho endpoint dashboard và tracking | P1 | 3,0 | E8-T8, E7-T3 | devops | | Báo cáo p50/p95/p99 + mô tả tập dữ liệu và máy đo; **mục tiêu đề xuất** p95 dashboard < 500 ms |
| E13-T6 | Usability test với ≥ 5 người dùng thật theo 3 kịch bản (học viên, giảng viên, admin) | P1 | 2,0 | E10-T4, E5-T6 | docs | | Có biên bản: người thử, kịch bản, thời gian hoàn thành, vấn đề gặp, mức độ nghiêm trọng |
| E13-T7 | UAT theo acceptance criteria proposal §3.2 | P0 | 2,5 | E13-T2, E13-T4 | docs | | Bảng đối chiếu từng acceptance criterion → Pass/Fail + bằng chứng (ảnh/test/log); là đầu vào của mục 11 |
| E13-T8 | Bug bash + sửa lỗi (buffer chính thức) | P0 | 4,0 | E13-T2 | backend | | Danh sách bug có mức độ; bug mức cao (blocker/critical) = 0 trước khi vào tuần 48 |
| E13-T9 | Bộ dữ liệu kiểm thử cố định (fixtures) dùng chung cho backend/AI/e2e | P0 | 2,0 | E9-T4 | db | | ≥ 1 bộ fixture có version, dùng bởi ≥ 2 loại test; reset DB test bằng 1 lệnh |

**DoD cấp epic E13:** có báo cáo test (mục 7.6) và **0 bug mức blocker/critical** trước tuần 48.

---

### E14 — Báo cáo & demo

**Mục tiêu:** chuyển toàn bộ công sức kỹ thuật thành sản phẩm bàn giao học thuật đúng hạn.

**Ánh xạ yêu cầu:** proposal §6.1 tuần 44, 48, 49, 50; §6.3 (deadline nội bộ 48h, dry-run sớm).

| Task ID | Tên | Ưu tiên | Est. | Phụ thuộc | Nhãn | Người nhận | DoD (kiểm chứng được) |
|---|---|---|---|---|---|---|---|
| E14-T1 | Báo cáo giữa kỳ (≤ 10 trang) + nộp đúng hạn tuần 44 | P0 | 3,0 | E9-T2, E8-T4 | docs | | Nộp **trước hạn chính thức 48h**; có mục kiến trúc, tiến độ, kế hoạch phần còn lại, rủi ro |
| E14-T2 | Báo cáo cuối (theo cấu trúc/rubric của giảng viên) | P0 | 6,0 | E13-T7, E9-T5 | docs | | Có đủ: đặt vấn đề, kiến trúc, thiết kế DB, đánh giá model **với số liệu đo thật**, kết quả test, hạn chế, hướng phát triển |
| E14-T3 | Slide bảo vệ | P0 | 3,0 | E14-T2 | docs | | Slide khớp kịch bản demo; bố cục theo luồng demo rõ ràng |
| E14-T4 | Kịch bản demo + phân vai + tập dượt | P0 | 3,0 | E10-T4, E11-T2 | docs | | Kịch bản ghi rõ từng bước, người thao tác, thời lượng; đã chạy thử ≥ 2 lần thành công trên môi trường deploy |
| E14-T5 | Video quay sẵn toàn bộ luồng demo (phương án dự phòng mạng) | P1 | 2,0 | E14-T4 | docs | | Video ≥ 5 phút, quay trên môi trường thật, phát được offline từ máy cá nhân |
| E14-T6 | README hướng dẫn chạy + tài liệu API + hướng dẫn deploy/seed | P0 | 3,0 | E0-T5, E9-T11 | docs | | Một người ngoài nhóm làm theo README dựng được hệ thống trong ≤ 60 phút |
| E14-T7 | Đóng gói nộp bài (source, báo cáo, slide, dữ liệu demo, script seed) | P0 | 1,5 | E14-T2 | docs | | Gói nộp có checklist; kiểm tra mở được từ máy khác; nộp **trước hạn 48h** |
| E14-T8 | Tổng duyệt demo cuối (2 buổi) + xử lý tồn đọng | P0 | 3,0 | E14-T4 | docs | | Biên bản 2 buổi duyệt; danh sách tồn đọng có người phụ trách và hạn; buổi duyệt thứ hai không còn lỗi chặn demo |

**DoD cấp epic E14:** toàn bộ gói bàn giao đã nộp trước hạn 48h và demo chạy thành công 2 lần liên tiếp.

---

## 5. Đường găng (critical path)

### 5.1. Chuỗi phụ thuộc quyết định tiến độ

```
E0-T4 (tắt synchronize + DataSource CLI)
   └─► E0-T5 (migration baseline)
          ├─► E0-T6 (seed) ──────────────────────────────┐
          └─► E1-T1 (login) ─► E1-T2 (JWT/refresh)       │
                  └─► E1-T3 (RBAC guard)                  │
                          ├─► E1-T6 (ownership guard)     │
                          │      └─► E7-T2 (ghi event)    │
                          └─► E3-T1 (Course)              │
                                  └─► E3-T2 (Lesson) ─────┤
                                          └─► E4-T1 (enrollment)
                                                  └─► E4-T2 (progress)
                                                          └─► E5-T2 (submission/điểm)
                                                                  └─► E7-T1 (learning_events)
                                                                          └─► E8-T1 (aggregation)
                                                                                  └─► E8-T3 (feature store)
                                                                                          └─► E9-T2 (rule-based risk)
                                                                                                  └─► E9-T7 (BullMQ)
                                                                                                          └─► E9-T8 (AIGateway)
                                                                                                                  └─► E9-T9 (risk_predictions)
                                                                                                                          └─► E10-T1 (intervention)
                                                                                                                                  └─► E10-T4 (gửi can thiệp)
                                                                                                                                          └─► E11-T2 (thông báo tự động)
                                                                                                                                                  └─► E13-T7 (UAT)
                                                                                                                                                          └─► E14-T4 (kịch bản demo)
                                                                                                                                                                  └─► E14-T7 (nộp)
```

**Đường găng (chuỗi dài nhất, quyết định ngày kết thúc dự án):**

`E0-T4 → E0-T5 → E1-T1 → E1-T2 → E1-T3 → E1-T6 → E3-T1 → E3-T2 → E4-T1 → E4-T2 → E5-T2 → E7-T1 →
E7-T2 → E8-T1 → E8-T3 → E9-T2 → E9-T7 → E9-T8 → E9-T9 → E10-T1 → E10-T4 → E11-T2 → E13-T7 → E14-T4 → E14-T7`

**Tổng ước lượng đường găng:** ≈ **63,5 NC** trên chuỗi (không tính phần chạy song song).
Với 5 người, phần lớn task trên đường găng **không parallel hoá được** — đây chính là lý do
tuần 46 là mốc căng nhất và vì sao "đóng phạm vi" phải xảy ra ở đó.

---

## 10. Ma trận truy vết (traceability)

Ma trận này nối **yêu cầu trong proposal** → **acceptance criteria / tiêu chí demo** → **epic** →
**task ID**. Cột "Trạng thái" ban đầu là `Chưa bắt đầu` cho mọi dòng; cập nhật khi task thực sự xong
(code chạy được, CI xanh, DoD của task đã kiểm chứng).

### 10.1. Ba user story trong proposal §3.2

| Yêu cầu / User story (proposal) | Acceptance criteria (trích §3.2) | Epic | Task ID | Trạng thái |
|---|---|---|---|---|
| **Student** — "I want to search for and enroll in courses, access learning materials, take practice quizzes, and track my learning progress, so that I can self-monitor my learning and receive early warnings when I fall behind." | "Students can search for, enroll in courses, and access published materials." | E3, E4 | E3-T3, E3-T6, E3-T7, E3-T8, E4-T1, E4-T4 | **Một phần** — E3-T3/T6/T7/T8 xong 2026-10-03 (tìm kiếm + ghi danh + xem học liệu đã publish) và `POST /api/enrollments` là lát cắt tối thiểu kéo từ E4-T1; còn E4-T1 (danh sách/huỷ/tiến độ) và E4-T4 |
| (Student) | "Progress is tracked via completed lessons and quizzes." | E4, E5 | E4-T2, E4-T3, E4-T5, E5-T2, E5-T4, E5-T6, E5-T7 | Chưa bắt đầu |
| (Student) | "Learning behavior and assessment results are utilized to detect risk and trigger in-app early warnings." | E7, E8, E9, E11 | E7-T1, E7-T2, E7-T4, E8-T3, E9-T2, E9-T6, E9-T9, E11-T1, E11-T2 | Chưa bắt đầu |
| **Instructor** — "I want to view learner performance and early warning indicators on my dashboard, so that I can monitor learning progress and provide timely intervention for struggling learners." | "Instructors can monitor progress, assessment results, and learning behavior." | E3, E5, E8 | E3-T1, E3-T2, E3-T9, E5-T1, E5-T5, E5-T8, E8-T1, E8-T4, E8-T6, E8-T7 | **Một phần** — E3-T1/T2/T9 xong 2026-10-03 (soạn khoá học, chương–bài, upload học liệu, publish/ẩn; giảng viên chỉ sửa được khoá mình phụ trách); dashboard và dữ liệu học viên thuộc E5/E8 |
| (Instructor) | "At-risk learners are highlighted along with contributing rationales on the dashboard." | E9, E10 | E9-T6, E9-T9, E10-T2, E10-T3 | Chưa bắt đầu |
| (Instructor) | "Instructors can also send direct intervention messages to individual learners." | E10, E11 | E10-T1, E10-T4, E11-T1, E11-T5, E10-T6 | Chưa bắt đầu |
| **Admin** — "I want to manage user accounts, course catalogs, content violation reports, and risk detection settings, so that I can maintain secure platform access, moderate content, and manage the early warning system." | "Administrators can manage roles, access permissions, course catalogs, and violation reports." | E1, E2, E3, E6 | E1-T3, E1-T5, E2-T2, E2-T5, E3-T1, E3-T3, E6-T2, E6-T4 | **Một phần** — RBAC + trạng thái tài khoản (E1), đổi vai trò + danh sách người dùng (E2), quản lý danh mục/khoá học/phân công giảng viên/lớp (E3, 2026-10-03); còn E6 (báo cáo vi phạm, kiểm duyệt) |
| (Admin) | "Risk detection settings are configurable via the admin portal, with all actions and configuration changes logged in audit trails." | E12 | E12-T1, E12-T2, E12-T3, E12-T5 | Chưa bắt đầu |

### 10.2. Các nhóm chức năng trong proposal §3.1

| Nhóm chức năng (§3.1) | Nội dung yêu cầu | Epic | Task ID | Trạng thái |
|---|---|---|---|---|
| **Tài khoản & phân quyền** | Đăng ký, đăng nhập/đăng xuất, khôi phục mật khẩu, hồ sơ người dùng, RBAC (Student/Instructor/Admin) trên mọi API, quản lý trạng thái tài khoản, audit log cho hành động quản trị | E1, E2, E12 | E1-T1, E1-T2, E1-T3, E1-T4, E1-T5, E1-T6, E1-T7, E1-T8, E2-T1, E2-T2, E2-T4, E2-T5, E12-T1 | **Gần đủ** — E1 xong (2026-10-03) và E2-T1/T2/T4/T5 xong (2026-10-03); thiếu audit log hành động quản trị (E12-T1) và các test tự động (E1-T9, e2e E1-T6, E2-T6 → hoãn sang E13) |
| **Khoá học & nội dung** | Catalog có tìm kiếm/lọc/phân trang; trang chi tiết khoá (syllabus, giảng viên, điều kiện tiên quyết); cấu trúc chương–bài hỗ trợ văn bản, slide, video; giảng viên tạo/sửa/publish/ẩn nội dung | E3 | E3-T1, E3-T2, E3-T3, E3-T4, E3-T5, E3-T6, E3-T7, E3-T8, E3-T9 | **Xong (2026-10-03)** — E3-T1→T9 đã làm; E3-T10 (test quyền nội dung) đã kiểm chứng bằng script e2e 257 kiểm tra nhưng bản trong repo chuyển sang E13-T4. `mocks/course.ts` đã bị xoá |
| **Học & đánh giá** | Đăng ký khoá, theo dõi tiến độ, quiz có giới hạn thời gian + chấm điểm tự động, phản hồi của giảng viên, diễn đàn thảo luận, telemetry hành vi (thời gian hoàn thành, số lần thử) | E4, E5, E6, E7 | E4-T1, E4-T2, E4-T3, E4-T4, E4-T5, E5-T1, E5-T2, E5-T3, E5-T4, E5-T5, E5-T6, E5-T7, E5-T8, E6-T1, E6-T2, E6-T3, E6-T4, E7-T1, E7-T2, E7-T3, E7-T4, E7-T5 | Chưa bắt đầu |
| **AI analytics & cảnh báo sớm (Hướng 5)** | Pipeline phát hiện rủi ro tự động (FastAPI); dashboard giảng viên có giải thích ở mức feature; tin nhắn can thiệp trong ứng dụng | E8, E9, E10, E11 | E8-T1, E8-T2, E8-T3, E8-T4, E8-T5, E8-T6, E8-T7, E8-T8, E9-T1, E9-T2, E9-T3, E9-T4, E9-T5, E9-T6, E9-T7, E9-T8, E9-T9, E9-T10, E9-T11, E9-T12, E10-T1, E10-T2, E10-T3, E10-T4, E10-T5, E10-T6, E11-T1, E11-T2, E11-T3, E11-T4, E11-T5, E11-T6 | Chưa bắt đầu |
| **Ngoài phạm vi (§3.1)** | Live-streaming classroom, MFA, cổng thanh toán tiền thật, nội dung bài học sinh tự động bằng AI | — | **Không có task** — nếu ai đề xuất, ghi vào backlog sau đồ án (mục 2.3) | Không áp dụng |

### 10.3. Ba tiêu chí demo trong proposal §4.3

| Tiêu chí demo (§4.3) | Diễn giải kiểm chứng được | Epic | Task ID | Trạng thái |
|---|---|---|---|---|
| **(1)** "Real-time data updates and visualization on the instructor dashboard" | Dashboard giảng viên đọc dữ liệu thật; khi một học viên phát sinh hoạt động mới (làm quiz / hoàn thành bài), số liệu trên dashboard **thay đổi** khi tải lại hoặc sau khi job tổng hợp chạy | E7, E8 | E7-T2, E7-T4, E8-T1, E8-T2, E8-T3, E8-T4, E8-T6 | Chưa bắt đầu |
| **(2)** "Accurate classification and flagging of at-risk learners along with feature-level explainability based on simulated data" | Có danh sách học viên gắn cờ low/medium/high, mỗi học viên có **risk score + >= 2 lý do** ở mức feature; kết quả sinh từ pipeline trên dữ liệu mô phỏng, có đo precision/recall so với baseline | E9, E10, E8 | E9-T2, E9-T3, E9-T4, E9-T5, E9-T6, E9-T9, E9-T12, E10-T2, E10-T3, E8-T3 | Chưa bắt đầu |
| **(3)** "Automated execution of intervention workflows, such as dispatching in-app notifications or emails to learners" | Khi cờ rủi ro ở mức medium/high được tạo, hệ thống **tự động** tạo thông báo in-app cho học viên (và email nếu đã bật), không cần thao tác thủ công trên DB trong lúc demo | E10, E11 | E10-T1, E10-T2, E10-T4, E10-T6, E11-T1, E11-T2, E11-T3 | Chưa bắt đầu |

### 10.4. Truy vết ngược: mọi epic đều có mặt trong ma trận

| Epic | Xuất hiện ở mục | Epic | Xuất hiện ở mục |
|---|---|---|---|
| E0 Tiền đề | 11.1–11.3 (gián tiếp, nền cho mọi tiêu chí) — xem thêm mục 3 | E8 Analytics dashboard | 11.1, 11.2, 11.3 |
| E1 Xác thực & phân quyền | 11.1, 11.2 | E9 AI service & pipeline | 11.1, 11.2, 11.3 |
| E2 Người dùng & hồ sơ | 11.1, 11.2 | E10 Giải thích & can thiệp | 11.1, 11.2, 11.3 |
| E3 Khoá học & nội dung | 11.1, 11.2 | E11 Thông báo | 11.1, 11.2, 11.3 |
| E4 Học tập & tiến độ | 11.1, 11.2 | E12 Quản trị & audit | 11.1, 11.2 |
| E5 Quiz & chấm điểm | 11.1, 11.2 | E13 Kiểm thử chất lượng | 11.5 (kiểm chứng toàn bộ) |
| E6 Thảo luận & kiểm duyệt | 11.1, 11.2 | E14 Báo cáo & demo | 11.5 (bàn giao toàn bộ) |
| E7 Telemetry hành vi | 11.1, 11.2, 11.3 | | |

### 10.5. Truy vết cho E13 (kiểm thử) và E14 (bàn giao)

| Hạng mục | Kiểm chứng điều gì | Task ID | Trạng thái |
|---|---|---|---|
| Kiểm thử chức năng theo acceptance criteria | Toàn bộ 11.1 (3 user story) | E13-T1, E13-T2, E13-T3, E13-T7 | Chưa bắt đầu |
| Kiểm thử bảo mật & phân quyền | 11.2 nhóm "Tài khoản & phân quyền"; các mục S1–S12 (mục 7.3) | E13-T4, E1-T6, E2-T6 | **Một phần** — auth/IDOR/RBAC của E1 (93 kiểm chứng) và RBAC người dùng của E2 (80 kiểm chứng, 2026-10-03) đã kiểm chứng thủ công nhưng **chưa** thành test tự động: E1-T6 (e2e), E1-T9 và E2-T6 hoãn sang E13-T4 |
| Kiểm thử hiệu năng | Tiêu chí demo (1) — dashboard phản hồi trong ngưỡng đề xuất | E13-T5, E8-T8, E7-T3 | Chưa bắt đầu |
| Kiểm thử usability | 3 vai trò theo user story | E13-T6 | Chưa bắt đầu |
| Bàn giao học thuật | Báo cáo giữa kỳ (tuần 44), báo cáo cuối + slide + kịch bản demo + video (tuần 48–50) | E14-T1, E14-T2, E14-T3, E14-T4, E14-T5, E14-T6, E14-T7, E14-T8 | Chưa bắt đầu |

---

*Tài liệu này được soạn từ `docs/proposal.md` và `docs/architecture.md`. Khi hai tài liệu đó thay đổi, cập nhật lại file này.*
