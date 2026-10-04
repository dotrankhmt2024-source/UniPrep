# Wireframe & mapping design system — UniPrep

> Phiên bản: v0.1 — Ngày: 2026-09-26
> Task nguồn: **E0-T12** (`docs/04-plan/implementation-plan.md`)
> Trạng thái: **tài liệu làm việc cho AI agent coding** (nằm ngoài repo `UniPrep/`, xem `docs/README.md`)

---

## 1. Mục đích và giới hạn

Tài liệu này chốt **màn hình nào dùng khối nào của bộ component đang có** trước khi viết code, để:

1. Không ai vẽ lại HTML thủ công (điều `frontend/src/components/README.md` cấm rõ);
2. Mỗi màn hình có sẵn danh sách API + trạng thái loading/empty/error/permission để code không tự phát minh;
3. Task frontend trong WBS (E1-T7, E2-T4, E2-T5, E3-T6…T9, E4-T4, E4-T5, E5-T6…T8, E8-T6, E10-T3, E10-T4, E11-T5, E12-T3, E12-T4) không phải hỏi lại "màn này lấy component ở đâu".

**Giới hạn — đọc trước khi dùng:**

- Đây **không phải** bản vẽ pixel. Bản vẽ màu/layout tham khảo nằm ở `UniPrep/frontend/design/*.html`
  (`Course_list.html`, `Course_detail.html`, `Lecture.html`, `AI_insight.html`) — **chỉ để tham khảo**,
  tuyệt đối không copy HTML từ đó vào `src/`.
- Bộ component thật là **nguồn chân lý**: `UniPrep/frontend/src/components/` (xem `index.ts` để biết
  danh sách export). Nếu tài liệu này ghi một component không tồn tại, sửa tài liệu — không tự thêm
  component mới trong lúc làm page.
- Màn hình nào chưa có trong đây (ví dụ màn soạn đề của giảng viên) thì bổ sung một mục theo đúng
  khuôn mẫu §3 trước khi code.

### 1.1. Bộ component dùng được (tại thời điểm viết tài liệu)

| Nhóm | Export từ `@/components` | Dùng cho |
|---|---|---|
| Nút | `ISolidBtn`, `IOutLinedBtn`, `IOutlinedBtn` (alias), `SolidBtn`, `OutlinedBtn`, `IconBtn` | Mọi hành động. **Không** viết `<button>` trần |
| Bảng | `ITable` (props: `pagination` bắt buộc, `filters`, `syncLocation`, `showSTT`) | Mọi danh sách dạng bảng |
| Form | `FormItem`, `PasswordInput`, `ConfirmPassword` | Mọi field; `FormItem` bọc `label`/`rules`/lỗi |
| Trạng thái | `Badge` (`status`, `dot`, `uppercase`, `size`), `ErrorBadge` | Pill trạng thái, lỗi API. **Không** viết `<span className="rounded-full">` |
| Icon | `Icon` (icon Material qua `name`) | Icon trong UI; icon thư viện antd dùng trực tiếp |
| Nội dung | `RichTextEditor` (+ `CasingExtension`) | Soạn nội dung TipTap (bài học, thông báo) |
| Hook | `useDebounce`, `useMutation` | Ô tìm kiếm; gọi API có trạng thái loading/error |
| Layout | `layouts/private` (Header + Sider + `Outlet`), `config/sider-options` | Khung trang private; menu **chỉ** sửa ở `sider-options` |

Quy ước bắt buộc khi làm bất kỳ màn hình nào dưới đây:

1. Luồng dữ liệu `apis/<feature>` → `types/<feature>` → `pages/<feature>` (không gọi axios trong page).
2. Page chỉ render nội dung; header/sider thuộc layout.
3. Nhãn trạng thái là **dữ liệu** (`Record<UnionType, string>` trong `types/`), không phải `? :` rải rác.
4. Mọi vùng dữ liệu phải có **4 trạng thái**: `loading`, `empty`, `error` (`ErrorBadge`), và trạng thái
   không có quyền (ẩn menu + chặn route, xem E1-T8).

---

## 2. Bảng tổng hợp 9 màn hình trọng yếu

| # | Màn hình | Route | Task | API chính | Tham khảo |
|---|---|---|---|---|---|
| 1 | Đăng nhập | `/login` | E1-T7 | `POST /api/auth/login`, `GET /api/auth/me` | — |
| 2 | Đăng ký | `/register` | E1-T7 | `POST /api/auth/register` | — |
| 3 | Quên / đặt lại mật khẩu | `/forgot-password`, `/reset-password` | E1-T7 | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` | — |
| 4 | Catalog khoá học | `/` | E3-T6, E4-T4 | `GET /api/courses`, `GET /api/categories`, `GET /api/enrollments` | `design/Course_list.html` |
| 5 | Chi tiết khoá học + syllabus | `/courses/:courseId` | E3-T7 | `GET /api/courses/:id`, `POST /api/enrollments` | `design/Course_detail.html` |
| 6 | Trình xem bài học | `/courses/:courseId/lessons/:lessonId` | E3-T8, E4-T5, E7-T4 | `GET /api/lessons/:id`, `POST /api/lessons/:id/complete`, `GET /api/courses/:id/progress` | `design/Lecture.html` |
| 7 | Làm bài quiz | `/quizzes/:quizId/attempt` | E5-T6 | `POST /api/quizzes/:id/attempts`, `POST /api/submissions` | — |
| 8 | Kết quả & xem lại lỗi | `/submissions/:id` | E5-T7 | `GET /api/submissions/:id`, `GET /api/submissions/:id/review` | — |
| 9 | Dashboard giảng viên + at-risk | `/analytics` | E8-T6, E10-T3 | `GET /api/analytics/courses/:id/overview`, `.../trends`, `.../at-risk` | `design/AI_insight.html` |

Hai màn hình phụ nhưng bắt buộc phải có (làm cùng nhóm task ở trên, không tính vào 9):

| Màn hình | Route | Task | API chính |
|---|---|---|---|
| Hồ sơ cá nhân | `/profile` | E2-T4 | `GET/PATCH /api/users/me`, `POST /api/auth/change-password` |
| Quản lý người dùng (admin) | `/admin/users` | E2-T5 | `GET /api/users`, `PATCH /api/users/:id/role`, `PATCH /api/users/:id/status` |

---

## 3. Chi tiết từng màn hình

### 3.1. Đăng nhập — `/login` (E1-T7)

**Mục tiêu:** một học viên/giảng viên/admin đăng nhập và vào thẳng layout private theo vai trò.

**Khối layout (1 cột, không dùng layout private):**

1. Logo/tên sản phẩm **UniPrep** + dòng mô tả ngắn.
2. `Form` dọc: `FormItem` "Email" (`Input size="large"`), `FormItem` "Mật khẩu" bọc `PasswordInput`.
3. Hàng nút: `ISolidBtn` "Đăng nhập" (loading khi submit); link "Quên mật khẩu?" → `/forgot-password`.
4. Vùng lỗi: `ErrorBadge` hiển thị `message` **tiếng Việt** trả từ API (401 → "Email hoặc mật khẩu không đúng").
5. Chân trang: link "Chưa có tài khoản? Đăng ký".

**API:** `POST /api/auth/login` → lưu token + user vào Redux store (`AuthProvider`), sau đó
`GET /api/auth/me` nếu cần làm mới hồ sơ. Sai mật khẩu ⇒ 401, tài khoản `suspended`/`disabled` ⇒ 403 kèm
message riêng (E1-T5) — **không** gộp thành một câu chung.

**Trạng thái:** loading (nút disable + spinner), error (401/403/429 "quá nhiều lần thử"), success → điều
hướng tới `?redirect=` nếu có, mặc định `/`.

**Lưu ý:** không log giá trị mật khẩu; không đổ lỗi validate của antd bằng tiếng Anh — dùng `rules`
với message tiếng Việt.

---

### 3.2. Đăng ký — `/register` (E1-T7)

**Mục tiêu:** tạo tài khoản học viên mới.

**Khối layout:** `Form` dọc gồm `FormItem` Họ tên, Email, `PasswordInput` "Mật khẩu",
`ConfirmPassword` "Nhập lại mật khẩu"; khối điều khoản (`Checkbox` của antd) nếu nhóm yêu cầu; `ISolidBtn`
"Đăng ký"; link về `/login`.

**API:** `POST /api/auth/register`. Email trùng ⇒ 400 kèm message "Email đã được sử dụng" hiển thị ở
đúng field email (dùng `form.setFields`), không chỉ hiện ở đỉnh form.

**Trạng thái:** loading; error theo field; success → tự đăng nhập hoặc điều hướng `/login` kèm thông báo
(`message.success` tiếng Việt).

---

### 3.3. Quên / đặt lại mật khẩu — `/forgot-password`, `/reset-password` (E1-T7)

**Mục tiêu:** gửi yêu cầu đặt lại và đặt mật khẩu mới bằng token một lần.

**Khối layout:**

- `/forgot-password`: `FormItem` Email + `ISolidBtn` "Gửi liên kết". Sau khi gửi, **luôn** hiện thông báo
  trung tính "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn" — không tiết lộ email có tồn tại hay không.
- `/reset-password?token=...`: `PasswordInput` + `ConfirmPassword` + `ISolidBtn` "Đặt lại mật khẩu".

**API:** `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`. Token hết hạn/dùng lại ⇒ 400
với message riêng, kèm link quay lại `/forgot-password`.

**Trạng thái:** loading; error token; success → điều hướng `/login` + thông báo.

---

### 3.4. Catalog khoá học — `/` (E3-T6, E4-T4)

**Mục tiêu:** học viên tìm/lọc khoá học đã publish và thấy trạng thái đăng ký của mình.
Tham khảo bố cục: `frontend/design/Course_list.html`.

**Khối layout:**

1. Thanh công cụ: ô tìm kiếm (`Input` + `Icon name="search"`, debounce bằng `useDebounce` ≥ 300 ms),
   `Select` danh mục (`GET /api/categories`), `Select` trạng thái học (Đang học / Sắp tới / Đã kết thúc).
2. Lưới thẻ khoá học (`Row`/`Col` của antd + `Card`): tiêu đề, giảng viên, danh mục, số bài, `Badge`
   trạng thái học viên; nút `ISolidBtn` "Đăng ký" hoặc `IOutLinedBtn` "Vào học" tuỳ trạng thái.
3. Phân trang: **dùng `ITable` khi chọn chế độ bảng**, hoặc `Pagination` của antd cho chế độ thẻ —
   chốt ở E3-T6; nếu chọn bảng thì bắt buộc `ITable` với `pagination` + `syncLocation` để giữ filter trên URL.

**API:** `GET /api/courses?search=&category=&page=&limit=`, `GET /api/categories`,
`GET /api/enrollments` (để biết khoá nào đã đăng ký), `POST /api/enrollments` (E4-T1).

**Trạng thái:** `loading` (skeleton/spin), `empty` (antd `Empty` "Không có dữ liệu phù hợp"), `error`
(`ErrorBadge` + nút "Thử lại"), chưa đăng nhập ⇒ chuyển `/login`.

**Lưu ý:** màn này hiện đọc `src/mocks/course.ts`; **DoD của E3-T6 là không còn import nào từ file mock**
ở màn catalog.

---

### 3.5. Chi tiết khoá học + syllabus — `/courses/:courseId` (E3-T7)

**Mục tiêu:** xem mô tả, giảng viên, danh sách chương/bài và đăng ký.
Tham khảo: `frontend/design/Course_detail.html`.

**Khối layout:**

1. Khối hero: tên khoá, mã khoá, giảng viên, `Badge` trạng thái (`published` / `draft` chỉ hiện với
   `teacher`/`admin` sở hữu), nút `ISolidBtn` "Đăng ký học" (hoặc `IOutLinedBtn` "Huỷ đăng ký").
2. Khối syllabus: danh sách chương (accordion antd `Collapse`) → mỗi bài là một dòng có `Badge` trạng thái
   tiến độ (`not_started` / `in_progress` / `completed`) + thời lượng + icon loại học liệu.
3. Khối điều kiện tiên quyết (nếu có, E3-T5): `Badge status="warning"` + lý do khi `eligible = false`.
4. Khối `Tabs` "Thảo luận" (E6-T3) và "Bài kiểm tra" (E5-T6) — làm ở epic tương ứng, chưa cần ở E3-T7.

**API:** `GET /api/courses/:id`, `GET /api/courses/:courseId/sections`, `GET /api/courses/:courseId/lessons`,
`POST /api/enrollments`, `DELETE /api/enrollments/:id`.

**Trạng thái:** loading; 404 (khoá không tồn tại hoặc `draft` với người ngoài) → màn "Không tìm thấy"
kèm nút quay lại catalog; đã đăng ký ⇒ nút đổi thành "Vào học" (không gọi lại API đăng ký).

---

### 3.6. Trình xem bài học — `/courses/:courseId/lessons/:lessonId` (E3-T8, E4-T5, E7-T4)

**Mục tiêu:** đọc nội dung bài (HTML đã sanitize), xem video, điều hướng bài trước/sau, đánh dấu hoàn
thành, "tiếp tục học". Tham khảo: `frontend/design/Lecture.html`.

**Khối layout (2 cột, cột phải là danh sách bài):**

1. Cột trái: tiêu đề bài, khối nội dung `dangerouslySetInnerHTML` **sau khi sanitize** (E3-T2/T8), khối
   video (`<video controls>` bọc trong `Card`, ghi event `video_watched` khi đạt ngưỡng), khối học liệu
   (`slide`/`file`/`link`).
2. Thanh dưới: `IOutLinedBtn` "Bài trước", `ISolidBtn` "Đánh dấu hoàn thành" (hoặc "Bỏ hoàn thành"),
   `IOutLinedBtn` "Bài tiếp theo".
3. Cột phải: danh sách bài theo chương, bài hiện tại được highlight, `Badge` trạng thái từng bài; đầu
   cột có thanh tiến độ khoá (`Progress` của antd) lấy từ `% hoàn thành` (E4-T2).
4. Nút "Tiếp tục học" ở catalog/khoá gọi resumé (E4-T3): trả bài gần nhất chưa xong, `null` ⇒ thông báo
   "Bạn đã hoàn thành khoá học".

**API:** `GET /api/lessons/:id`, `GET /api/courses/:courseId/lessons`, `POST /api/lessons/:id/complete`,
`DELETE /api/lessons/:id/complete`, `GET /api/courses/:id/progress`, `POST /api/learning-events`.

**Trạng thái:** loading nội dung; bài `draft`/không thuộc khoá đã đăng ký ⇒ 403/404 và **không** render
nội dung; mất mạng khi đang học ⇒ không chặn UI, event tracking thất bại chỉ ghi log (E7-T4).

---

### 3.7. Làm bài quiz — `/quizzes/:quizId/attempt` (E5-T6)

**Mục tiêu:** làm bài có giới hạn thời gian, không mất đáp án khi chuyển câu.

**Khối layout:**

1. Header bài làm: tên quiz, `Badge status="processing"` "Còn lại mm:ss" tính từ `expiresAt` **của server**
   (không dùng đồng hồ client), số câu đã trả lời / tổng.
2. Khối câu hỏi: số thứ tự + nội dung; với `single_choice`/`true_false` dùng `Radio.Group`, với
   `multiple_choice` dùng `Checkbox.Group`, với `short_answer`/`essay` dùng `Input`/`TextArea`.
   **Không** hiển thị đáp án đúng trong lúc làm (E5-T1).
3. Điều hướng câu: dải số câu (`Button` nhỏ) đánh dấu đã trả lời/chưa; `ISolidBtn` "Nộp bài" + xác nhận
   (`Modal.confirm` của antd) khi còn câu trống.
4. Autosave: lưu nháp theo câu (local state + `useMutation`), cảnh báo `beforeunload` khi rời trang.

**API:** `POST /api/quizzes/:id/attempts` (tạo phiên, trả `expiresAt`), `GET /api/attempts/:id`,
`POST /api/submissions`. Hết giờ ⇒ nộp tự động; server từ chối nộp muộn (E5-T3) và client hiển thị đúng
message đó.

**Trạng thái:** hết giờ (đóng form, chuyển sang màn kết quả); vượt `maxAttempts` ⇒ chặn ngay từ đầu kèm
lý do; lỗi mạng khi nộp ⇒ giữ nguyên đáp án tại chỗ, cho nộp lại.

---

### 3.8. Kết quả & xem lại lỗi — `/submissions/:id` (E5-T7)

**Mục tiêu:** thấy điểm, số câu đúng/sai và từng câu sai kèm đáp án đúng + giải thích.

**Khối layout:**

1. Khối tổng kết: điểm (`Card` lớn), `Badge` mức đạt (`success` ≥ 80 %, `warning` 50–79 %, `error` < 50 %),
   số câu đúng/tổng, thời gian làm bài, `attempt_no`.
2. Danh sách câu: mỗi câu là một `Card` (hoặc `Collapse`) với `Badge` "Đúng"/"Sai"/"Bỏ trống", đáp án đã
   chọn, đáp án đúng, giải thích. Dùng `Badge`, **không** viết pill thủ công.
3. Nút: `IOutLinedBtn` "Làm lại" (nếu còn lượt), `ISolidBtn` "Quay lại khoá học".

**API:** `GET /api/submissions/:id`, `GET /api/submissions/:id/review`. Đáp án đúng **chỉ** có sau khi đã
nộp; nếu quiz đặt `showAnswersAfterSubmit = false` thì ẩn khối đáp án đúng và hiện ghi chú.

**Trạng thái:** bài chưa chấm (`submitted`) ⇒ `Badge status="processing"` "Đang chờ chấm", ẩn điểm;
bài `expired` ⇒ hiện lý do hết giờ.

---

### 3.9. Dashboard giảng viên + danh sách at-risk — `/analytics` (E8-T6, E10-T3)

**Mục tiêu:** giảng viên thấy số liệu lớp mình phụ trách **thay đổi khi có hoạt động mới** (tiêu chí demo
§4.3 (1)) và danh sách học viên rủi ro kèm lý do ở mức feature (tiêu chí demo §4.3 (2)).
Tham khảo: `frontend/design/AI_insight.html`.

**Khối layout:**

1. Bộ lọc: `Select` khoá học, `Select` lớp/cohort, `RangePicker` khoảng thời gian. Đổi filter ⇒ gọi lại
   API (ghi filter vào URL để chia sẻ được link).
2. Hàng thẻ KPI (`Row`/`Col` + `Card`): số học viên, tỉ lệ hoàn thành, điểm trung bình, số học viên rủi ro.
3. Biểu đồ: hoạt động theo ngày, phân bố điểm, xu hướng cohort (thư viện chart **chốt ở E8-T6**).
4. Bảng at-risk: **`ITable`** với cột Học viên, Lớp, `risk_score`, `Badge` `risk_level`
   (`high` → `error`, `medium` → `warning`, `low` → `success`), **≥ 2 lý do tiếng Việt** (E9-T6/E10-T3),
   nút `ISolidBtn` "Gửi can thiệp" mở `Modal` (E10-T4).

**API:** `GET /api/analytics/courses/:id/overview`, `.../trends`, `.../cohort-comparison`,
`.../at-risk`, `GET /api/analytics/learners/:id/timeline` (drill-down E8-T7),
`POST /api/interventions`, `POST /api/ai/jobs/:id` khi cần chạy lại dự đoán (`GET /api/ai/jobs/:id` để poll).

**Trạng thái:** `loading` (mỗi thẻ/biểu đồ có spin riêng, không chặn cả trang); `empty` khi lớp chưa có
hoạt động ("Chưa có dữ liệu trong khoảng thời gian này"); `error` >> 403 khi giảng viên mở lớp không
phụ trách (E8-T4) — hiển thị "Bạn không có quyền xem lớp này", **không** hiển thị số liệu rỗng gây hiểu nhầm.

---

### 3.10. Hồ sơ cá nhân — `/profile` (E2-T4)

**Khối layout:** `Card` thông tin (avatar, họ tên, email, vai trò `Badge`, mã học viên/lớp) + `Form` sửa
họ tên, điện thoại, tiểu sử; khối riêng "Đổi mật khẩu" (`PasswordInput` mật khẩu cũ + mới +
`ConfirmPassword`). `ISolidBtn` "Lưu thay đổi" ở mỗi khối.

**API:** `GET/PATCH /api/users/me`, `POST /api/users/me/avatar` (nếu làm), `POST /api/auth/change-password`.
Vai trò **không** sửa được ở đây; nếu request cố gửi `role`, `whitelist` của `ValidationPipe` loại bỏ
(E2-T1).

**Trạng thái:** sau khi lưu, `refetch` để reload vẫn thấy dữ liệu mới; lỗi đổi mật khẩu sai mật khẩu cũ
⇒ 400 hiển thị bằng `ErrorBadge`/`FormItem` (không dùng `alert`).

---

### 3.11. Quản lý người dùng (admin) — `/admin/users` (E2-T5)

**Khối layout:** thanh lọc (`Input` tìm theo tên/email + `Select` vai trò + `Select` trạng thái) và
**`ITable`** (`pagination` + `syncLocation` + `filters`) với cột: họ tên, email, vai trò (`Badge`), trạng
thái (`Badge`), ngày tạo, hành động. Hành động đổi vai trò/ khoá tài khoản mở `Modal.confirm` (mô tả rõ
hệ quả) rồi gọi API.

**API:** `GET /api/users`, `PATCH /api/users/:id/role`, `PATCH /api/users/:id/status`, `GET /api/users/:id`.
Admin không tự hạ vai trò của chính mình (E2-T2) ⇒ lỗi 400 hiển thị message.

**Trạng thái:** chỉ `admin` vào được (`ProtectedRoute` theo vai trò, E1-T8); mọi thao tác đổi vai trò/khoá
sinh audit log (E12-T1) — UI không cần hiển thị nhưng phải gọi đúng endpoint.

---

## 4. Việc phải làm khi thêm một màn hình mới

1. Thêm một mục vào §2 và một mục §3 theo khuôn: **mục tiêu → khối layout → component → API → trạng thái
   → lưu ý**.
2. Nếu cần component chưa có trong `frontend/src/components/`, viết nó vào `components/` **trước**, cập
   nhật `components/README.md` + mục §1.1 của tài liệu này, rồi mới dùng trong page.
3. Nếu màn hình cần endpoint chưa có trong `docs/02-specs/api-specification.md`, bổ sung spec trước khi code.
