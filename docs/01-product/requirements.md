# Đặc tả yêu cầu — UniPrep

> Phiên bản: v0.1 — Ngày: 2026-09-19
> Trạng thái: bản đặc tả chi tiết hoá `docs/proposal.md` để dùng khi code. Chưa được nhóm review.

Tài liệu này **không thay thế** `docs/proposal.md`. Proposal là cam kết với giáo viên (4 trang,
ngắn gọn); tài liệu này là bản dịch proposal thành các yêu cầu kiểm chứng được, có mã số, để
nhóm dùng làm nguồn cho backlog, cho test case và cho ma trận truy vết (§10).

---

## 1. Tổng quan

### 1.1 Bối cảnh

Ở bậc đại học, tài liệu học tập thường được phát qua LMS (điển hình là Moodle). LMS làm tốt việc
đăng nội dung, thu bài và ghi điểm, nhưng **không hỗ trợ tốt quá trình tự học và ôn luyện** của
sinh viên. Trong quá trình học, sinh viên gặp ba vấn đề (`proposal.md` §1.1):

1. **Tài liệu phân tán** — slide, ghi chú, bài tập, đề luyện cũ nằm rải rác ở nhiều nơi; sinh viên
   phải tự gom qua ghi chú cá nhân hoặc nhóm chat.
2. **Thiếu cơ hội luyện tập có phản hồi** — không có bài luyện sát thực tế, không chấm ngay,
   không phân tích lỗi sai.
3. **Khó theo dõi tiến độ học tập** — sinh viên không biết mình đã học được chương nào, còn yếu
   phần nào, mức độ nắm bài tổng thể ra sao.

### 1.2 Mục tiêu sản phẩm

Xây dựng một nền tảng **hỗ trợ học tập** trực tuyến (UniPrep) **bổ trợ, không thay thế** LMS hiện có
(`proposal.md` §1.1), trong đó thành phần nâng cao là **Hướng 5 — Learning Analytics và cảnh báo
sớm**: biến dữ liệu tương tác thô của người học thành thông tin có thể hành động được, phục vụ
cả học viên lẫn giảng viên (`proposal.md` §4.1).

### 1.3 Mục tiêu đo lường được

| # | Mục tiêu | Cách chứng minh |
|---|---|---|
| G1 | Gom tài liệu học tập của một khoá về một chỗ, tổ chức theo chương/bài | Khoá học mẫu có cấu trúc chương → bài → tài liệu, truy cập được bằng 3 vai trò |
| G2 | Cho phép luyện tập có chấm điểm và phản hồi tức thì | Quiz có hẹn giờ, chấm tự động, xem lại lỗi sai |
| G3 | Hiển thị tiến độ học tập và mức độ nắm bài | Trang tiến độ học viên + dashboard giảng viên |
| G4 | Phát hiện sớm học viên chậm tiến độ, **có giải thích** | Danh sách at-risk kèm lý do mức feature trên dữ liệu mô phỏng |
| G5 | Tự động hoá can thiệp | Hệ thống gửi thông báo in-app cho học viên bị gắn cờ; giảng viên gửi tin nhắn can thiệp |
| G6 | Đánh giá model nghiêm túc so với baseline | Báo cáo Precision/Recall so với baseline rule-based trên tập test |

G4–G6 chính là ba tiêu chí demo trong `proposal.md` §4.3 và là phần được chấm điểm nâng cao.

### 1.4 Phạm vi

**Trong phạm vi:** tài khoản & phân quyền; danh mục/khoá học/chương/bài/tài liệu; quiz có hẹn giờ
và chấm tự động; ghi danh và theo dõi tiến độ; diễn đàn thảo luận; ghi nhận sự kiện hành vi;
dashboard analytics; phát hiện rủi ro bằng rule-based/ML kèm giải thích; thông báo và can thiệp;
quản trị người dùng, kiểm duyệt nội dung, audit log.

**Ngoài phạm vi** (`proposal.md` §3.1) — **không làm**, không nhận yêu cầu phát sinh:

- Lớp học trực tuyến (live-streaming).
- Xác thực đa yếu tố (MFA).
- Cổng thanh toán tiền thật.
- Sinh nội dung bài học động bằng AI.

Đối chiếu thêm với `proposal.md` (source of truth) để loại các phần **không có trong proposal**:

- Không xây lại LMS: không thay thế Moodle, không đồng bộ hai chiều với Moodle ở giai đoạn này
  (`proposal.md` §1.1 nói rõ sản phẩm **bổ trợ**, không thay thế).
- Không làm ứng dụng di động native.
- **Không làm phần học tiếng Anh và luyện nói/viết.** `architecture.md` §1 và §2 có nhắc *"web học
  tiếng Anh"*, *"luyện nói/viết có AI chấm/gợi ý"*, *"chấm phát âm"*, *"inference NLP"* — nhưng
  `proposal.md` **không** có những phần này. Theo thứ tự ưu tiên nguồn (`README.md` §1.1), đây là
  phần **sai nguồn** nên bị **loại khỏi phạm vi**, không phải "tuỳ chọn". Nội dung bài học theo
  proposal §3.1 chỉ gồm **text, slide, video** (kèm tệp đính kèm).
- Không làm "sinh nội dung bài học động bằng AI" (đã nêu ở trên, trùng `proposal.md` §3.1).

### 1.5 Định vị và khác biệt so với các giải pháp đã có

| Nền tảng | Điểm mạnh | Hạn chế (`proposal.md` §2.1) |
|---|---|---|
| Moodle | LMS mã nguồn mở, tuỳ biến mạnh qua hệ plugin | Báo cáo mặc định chủ yếu là **thống kê hồi cứu**, tĩnh |
| Coursera / edX | Lộ trình học có cấu trúc, có theo dõi tiến độ | Thiếu dashboard phân tích sâu cho giảng viên ở quy mô lớp nhỏ |
| Khan Academy | Theo dõi mức thành thạo kỹ năng rất tốt | Ít chú trọng phân tích **mẫu hành vi** để phát hiện học viên có nguy cơ |

**Khác biệt kỳ vọng** (`proposal.md` §2.2) — ba điểm phải thể hiện được trong demo:

1. **Báo cáo hồi cứu + dự báo sớm**: theo dõi hành vi học tập (đăng nhập, xem tài liệu, nộp bài)
   để kích hoạt cảnh báo sớm.
2. **Cảnh báo có thể giải thích và có thể hành động**: cảnh báo nêu rõ lý do, gửi email/in-app
   tự động, và chỉ ra học viên có nguy cơ cho giảng viên.
3. **Dashboard tập trung và trực quan**: dashboard cho giảng viên và quản trị viên, trực quan hoá
   dữ liệu người học theo thời gian.

---

## 2. Người dùng, vai trò và quyền

### 2.1 Định nghĩa vai trò

Hệ thống có đúng **3 vai trò** (`proposal.md` §1.2: Learner / Instructor / Administrator).
Định danh trong code là tiếng Anh, viết thường; nhãn hiển thị là tiếng Việt.

| Vai trò (code) | Nhãn hiển thị | Định nghĩa |
|---|---|---|
| `student` | Học viên / Sinh viên | Người học, ghi danh khoá học, làm quiz |
| `teacher` | Giảng viên | Người tạo và quản lý nội dung khoá học mình phụ trách, theo dõi học viên của mình |
| `admin` | Quản trị viên | Quản trị toàn hệ thống, kiểm duyệt, cấu hình cảnh báo, xem audit log |

**Cập nhật 2026-10-03 (E0):** module mẫu `student` và bảng legacy `students` **đã bị xoá** khỏi repo
(migration baseline dọn bảng). Mô hình người dùng đích là bảng `users` với cột `role` — xem
`02-specs/database-design.md` §3.1.1. Khi làm `AuthModule`/`UserModule` (E1), dùng `UserModule` làm
tham chiếu cấu trúc module: entity đã có sẵn ở `backend/src/user/entities/user.entity.ts`, chỉ còn thiếu
dto/service/controller. Câu hỏi mở Q2 (mục 13) đã được trả lời: **xoá**. Xem `README.md` §6.3.

### 2.2 Kỳ vọng của từng vai trò (theo `proposal.md` §1.2)

| Vai trò | Kỳ vọng |
|---|---|
| **Học viên** | Tổ chức việc học theo môn và chương; xem tài liệu học tập ở một chỗ; làm bài luyện có hẹn giờ, chấm ngay và xem lại lỗi; theo dõi tiến độ và tiếp tục từ chỗ dừng; nhận thông báo về nội dung mới và deadline |
| **Giảng viên** | Tạo khoá học và cấu trúc nội dung theo chương/bài; tải tài liệu lên; tạo quiz/bài luyện trắc nghiệm; công khai hoặc ẩn nội dung; xem kết quả tổng hợp để biết chủ đề học viên thấy khó |
| **Quản trị viên** | Quản lý người dùng, khoá học, danh mục; kiểm duyệt nội dung bị báo cáo; theo dõi thống kê cơ bản (ghi danh, tỉ lệ hoàn thành); lưu log các hành động quan trọng; bảo đảm hệ thống an toàn và ổn định |

### 2.3 Ma trận quyền ở mức chức năng

Ký hiệu: `✔` toàn quyền trên phạm vi được phép · `◐` chỉ trên dữ liệu của mình · `–` không có quyền.
Chi tiết từng endpoint nằm ở `02-specs/api-specification.md` (mục RBAC).

### 2.3b Ánh xạ nhóm chức năng → module NestJS

Bảng dưới đây là **ánh xạ thống nhất** giữa các nhóm yêu cầu ở §3, module NestJS và bảng dữ liệu.
`02-specs/api-specification.md` và `02-specs/database-design.md` dùng đúng các tên này.

| Nhóm yêu cầu | Module NestJS | Bảng dữ liệu chính |
|---|---|---|
| FR-1 Tài khoản & xác thực | `AuthModule`, `UserModule` | `users`, `refresh_tokens`, `password_reset_tokens` |
| FR-2 Danh mục, khoá học, nội dung | `CourseModule`, `LessonModule` | `categories`, `courses`, `course_instructors`, `cohorts`, `course_sections`, `lessons`, `lesson_materials` |
| FR-3 Ghi danh & tiến độ | `EnrollmentModule` (nhóm logic; xem ghi chú) | `enrollments`, `lesson_progress` |
| FR-4 Quiz & chấm điểm | `ExerciseModule` | `quizzes`, `quiz_questions`, `quiz_options`, `submissions`, `submission_answers` |
| FR-5 Diễn đàn | `DiscussionModule` (đề xuất — có thể nằm trong `CourseModule`) | `discussion_threads`, `discussion_posts`, `content_reports` |
| FR-6 Telemetry hành vi | `LearningActivityModule` | `learning_events` |
| FR-7 Dashboard analytics | `AnalyticsModule` | `learning_events`, `submissions`, `lesson_progress`, `daily_learning_stats` (MV, tuỳ chọn) |
| FR-8 Dự đoán, giải thích, can thiệp | `AIGatewayModule`, `AnalyticsModule`, `InterventionModule`, `NotificationModule` | `model_versions`, `risk_predictions`, `risk_feature_contributions`, `ai_jobs`, `interventions` |
| FR-9 Thông báo | `NotificationModule` | `notifications`, `alert_settings` |
| FR-10 Quản trị | `AdminModule` | `audit_logs`, `alert_settings`, `content_reports`, `users`, `courses` |

> **Ghi chú về tên module:** `architecture.md` §4 liệt kê 11 module và **không** có `EnrollmentModule`
> hay `DiscussionModule` tách riêng. Đặc tả API dùng hai tên này như **nhóm logic** cho dễ tra cứu.
> Cách triển khai nào cũng được, miễn là **thống nhất trong code**: hoặc tạo module riêng, hoặc đặt
> các route đó trong `CourseModule`/`LearningActivityModule`. Nhóm cần chốt một lần và ghi vào
> `coding-conventions.md` (xem câu hỏi mở Q5 ở §12).

| Nhóm chức năng | Học viên | Giảng viên | Quản trị viên |
|---|---|---|---|
| Quản lý tài khoản của chính mình | ✔ | ✔ | ✔ |
| Xem danh mục & danh sách khoá học đã công khai | ✔ | ✔ | ✔ |
| Tạo/sửa/xoá khoá học | – | ◐ (khoá mình phụ trách) | ✔ |
| Tạo/sửa/xoá chương, bài, tài liệu | – | ◐ | ✔ |
| Công khai / ẩn nội dung | – | ◐ | ✔ |
| Ghi danh / huỷ ghi danh (chính mình) | ✔ | – | ✔ |
| Làm quiz & nộp bài | ✔ (của mình) | – | – |
| Tạo quiz, câu hỏi, đáp án | – | ◐ | ✔ |
| Chấm điểm thủ công / phản hồi bài nộp | – | ◐ (lớp mình) | ✔ |
| Xem kết quả học tập của học viên | – (chỉ của mình) | ◐ (lớp mình) | ✔ |
| Diễn đàn: đăng bài, trả lời | ✔ | ✔ | ✔ |
| Diễn đàn: xoá/ẩn bài vi phạm | – | ◐ (khoá mình) | ✔ |
| Xem dashboard analytics của khoá | – (chỉ tiến độ của mình) | ◐ (khoá mình) | ✔ |
| Xem danh sách học viên at-risk | – | ◐ (lớp mình) | ✔ |
| Gửi tin nhắn can thiệp cho học viên | – | ◐ (lớp mình) | ✔ |
| Cấu hình ngưỡng cảnh báo | – | – | ✔ |
| Quản lý người dùng, đổi vai trò, khoá tài khoản | – | – | ✔ |
| Xem audit log | – | – | ✔ |

Nguyên tắc bắt buộc (`architecture.md` §8): giảng viên **chỉ** xem được dữ liệu của khoá/lớp mình
phụ trách; học viên **chỉ** xem được dữ liệu của chính mình. Đây là yêu cầu bảo mật, không phải
tính năng "nice to have" — sẽ được test ở giai đoạn kiểm thử bảo mật (xem `04-plan/implementation-plan.md` mục 7.3).

---

## 3. Yêu cầu chức năng

Mỗi yêu cầu có mã `FR-<nhóm>-<số>` để tham chiếu từ backlog, test case và ma trận truy vết §9.
Cột "Module" trỏ tới module NestJS dự kiến (`architecture.md` §4) và thư mục frontend tương ứng.

### FR-1. Tài khoản và xác thực

Module: `AuthModule`, `UserModule` · Frontend: `pages/auth/*`, `apis/auth`, `types/auth`

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-1.1 | Người dùng đăng ký được bằng email + mật khẩu; mặc định vai trò là `student` | Bắt buộc |
| FR-1.2 | Người dùng đăng nhập bằng email + mật khẩu, nhận access token và refresh token | Bắt buộc |
| FR-1.3 | Hệ thống tự động làm mới access token bằng refresh token; refresh token bị thu hồi khi đăng xuất | Bắt buộc |
| FR-1.4 | Người dùng đăng xuất được; token không còn hiệu lực | Bắt buộc |
| FR-1.5 | Người dùng yêu cầu đặt lại mật khẩu qua email và đặt mật khẩu mới bằng token dùng một lần | Bắt buộc |
| FR-1.6 | Người dùng đổi mật khẩu khi đã đăng nhập, phải nhập lại mật khẩu cũ | Bắt buộc |
| FR-1.7 | Người dùng xem và cập nhật hồ sơ của mình (họ tên, ảnh đại diện, thông tin liên hệ) | Bắt buộc |
| FR-1.8 | Mật khẩu được băm bằng bcrypt/argon2; không bao giờ trả về qua API | Bắt buộc |
| FR-1.9 | Chính sách mật khẩu: 8–16 ký tự, có chữ hoa, chữ thường, chữ số và ký tự đặc biệt | Bắt buộc |
| FR-1.10 | Quản trị viên khoá/mở tài khoản; tài khoản bị khoá không đăng nhập được | Bắt buộc |
| FR-1.11 | Quản trị viên đổi vai trò của người dùng; hành động được ghi vào audit log | Bắt buộc |
| FR-1.12 | Đăng nhập sai quá N lần trong khoảng thời gian T bị tạm chặn (rate limit) | Nên có |

> Chính sách mật khẩu FR-1.9 đã được cài sẵn ở component `PasswordInput` trong frontend; backend
> phải validate đúng cùng chính sách.

### FR-2. Danh mục, khoá học và nội dung

Module: `CourseModule`, `LessonModule` · Frontend: `pages/course-list`, `pages/course-content`,
`pages/teacher/*`, `apis/course`, `types/course`

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-2.1 | Có danh mục khoá học (phân cấp được hoặc phẳng — xem câu hỏi mở Q3) | Bắt buộc |
| FR-2.2 | Danh sách khoá học hỗ trợ tìm kiếm theo tên/mã, lọc theo danh mục, trạng thái, học kỳ, giảng viên | Bắt buộc |
| FR-2.3 | Danh sách khoá học phân trang bằng `PageMetaDto` (page/take), trả về `items` + `meta` | Bắt buộc |
| FR-2.4 | Trang chi tiết khoá học hiển thị đề cương, giảng viên, điều kiện tiên quyết, số bài học | Bắt buộc |
| FR-2.5 | Khoá học có cấu trúc **chương → bài** (`course_sections` → `lessons`), có thứ tự sắp xếp được | Bắt buộc |
| FR-2.6 | Bài học gắn được tài liệu nhiều định dạng: văn bản, slide, video (tệp tin hoặc liên kết) | Bắt buộc |
| FR-2.7 | Giảng viên tạo, sửa, xoá khoá học/chương/bài trong phạm vi mình phụ trách | Bắt buộc |
| FR-2.8 | Giảng viên công khai (publish) hoặc ẩn (hide) nội dung; nội dung ẩn không hiển thị cho học viên | Bắt buộc |
| FR-2.9 | Học viên đã ghi danh nhưng khoá học bị ẩn toàn bộ vẫn nhận được thông báo phù hợp thay vì lỗi | Nên có |
| FR-2.10 | Nội dung bài học soạn được bằng trình soạn thảo rich text (TipTap đã có sẵn trong repo) | Bắt buộc |
| FR-2.11 | Tải tệp lên có kiểm tra loại tệp và dung lượng (giới hạn cụ thể — xem câu hỏi mở Q4) | Bắt buộc |
| FR-2.12 | Sắp xếp lại thứ tự chương/bài bằng một thao tác kéo–thả hoặc API reorder | Nên có |

**Ghi chú về mô hình dữ liệu UI:** `frontend/src/types/course.ts` hiện dùng `CourseSection` (chương)
và `CourseModule` (bài) với mock data. Khi làm backend, giữ nguyên hình dạng dữ liệu ở tầng type,
chỉ đổi **nguồn** từ `mocks/course.ts` sang `apis/course` — đúng theo ghi chú đã có trong file type.
Tên bảng ở DB là `course_sections` và `lessons` (xem `02-specs/database-design.md`).

### FR-3. Ghi danh và theo dõi tiến độ

Module: `LearningActivityModule` (phần progress), `CourseModule` · Frontend: `pages/progress`, `apis/enrollment`

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-3.1 | Học viên ghi danh vào khoá học đã công khai | Bắt buộc |
| FR-3.2 | Học viên huỷ ghi danh; dữ liệu tiến độ/hành vi đã ghi vẫn được giữ lại (không xoá cứng) | Bắt buộc |
| FR-3.3 | Hệ thống theo dõi tiến độ theo **bài học đã hoàn thành** và **quiz đã làm** | Bắt buộc |
| FR-3.4 | Học viên đánh dấu hoàn thành một bài học; hệ thống ghi nhận thời điểm hoàn thành | Bắt buộc |
| FR-3.5 | Học viên xem được tiến độ tổng thể của mình theo khoá: % hoàn thành, số bài còn lại, chương yếu nhất | Bắt buộc |
| FR-3.6 | Học viên tiếp tục học từ chỗ dừng (resume) — hệ thống nhớ bài học gần nhất | Bắt buộc |
| FR-3.7 | Hệ thống ghi nhận thời gian học trên mỗi bài (`duration_seconds`) để phục vụ analytics | Bắt buộc |
| FR-3.8 | Học viên nhận thông báo khi có nội dung mới hoặc deadline sắp tới | Bắt buộc |

### FR-4. Quiz, bài luyện và chấm điểm

Module: `ExerciseModule` · Frontend: `pages/quiz/*`, `apis/quiz`

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-4.1 | Giảng viên tạo quiz trắc nghiệm gắn với một chương hoặc một bài học | Bắt buộc |
| FR-4.2 | Quiz có câu hỏi và đáp án; hỗ trợ ít nhất một đáp án đúng; có thể có nhiều đáp án đúng | Bắt buộc |
| FR-4.3 | Quiz đặt được thời gian làm bài (hẹn giờ) và số lần được làm lại | Bắt buộc |
| FR-4.4 | Học viên bắt đầu một lượt làm bài; hệ thống ghi nhận thời điểm bắt đầu và số thứ tự lượt (`attempt_no`) | Bắt buộc |
| FR-4.5 | Hệ thống chấm điểm tự động ngay khi nộp bài và trả về điểm, số câu đúng/sai | Bắt buộc |
| FR-4.6 | Học viên xem lại bài làm: câu nào đúng/sai, đáp án đúng là gì, giải thích (nếu giảng viên nhập) | Bắt buộc |
| FR-4.7 | Hết thời gian, bài được tự động nộp với những câu đã trả lời | Bắt buộc |
| FR-4.8 | Giảng viên xem danh sách bài nộp của khoá, lọc theo học viên và theo quiz | Bắt buộc |
| FR-4.9 | Giảng viên cho điểm và phản hồi bằng văn bản trên một bài nộp | Bắt buộc |
| FR-4.10 | Hệ thống lưu số lần làm lại và thời gian làm từng lượt để phục vụ phát hiện bất thường | Bắt buộc |
| FR-4.11 | Quiz có thể trộn thứ tự câu hỏi/đáp án | Tuỳ chọn |
| FR-4.12 | Quiz có thể đặt điều kiện mở (theo thời gian) | Tuỳ chọn |

Chi tiết bảng: `quizzes`, `quiz_questions`, `quiz_options`, `submissions`, `submission_answers`.

### FR-5. Diễn đàn thảo luận

Module: `CourseModule` (hoặc module riêng `DiscussionModule` — xem Q5) · Frontend: `pages/discussion`

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-5.1 | Người dùng đã ghi danh tạo được chủ đề thảo luận trong khoá học | Bắt buộc |
| FR-5.2 | Người dùng trả lời trong một chủ đề | Bắt buộc |
| FR-5.3 | Danh sách chủ đề phân trang, sắp xếp theo hoạt động gần nhất | Bắt buộc |
| FR-5.4 | Giảng viên/admin ẩn hoặc xoá bài viết vi phạm | Bắt buộc |
| FR-5.5 | Hệ thống ghi nhận số lượt tương tác diễn đàn để phục vụ analytics | Bắt buộc |
| FR-5.6 | Người dùng báo cáo một bài viết vi phạm (`content_reports`) | Bắt buộc |

### FR-6. Ghi nhận sự kiện hành vi (telemetry)

Module: `LearningActivityModule` · Frontend: hook gửi sự kiện dùng chung

Đây là **nguồn dữ liệu cho toàn bộ Hướng 5**. Nếu phần này không chạy, mọi thứ phía sau
(dashboard, dự đoán rủi ro, can thiệp) không thể chứng minh được.

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-6.1 | Hệ thống ghi nhận **tối thiểu 8 loại sự kiện bắt buộc**: `login`, `lesson_started`, `lesson_completed`, `material_viewed`, `quiz_started`, `quiz_submitted`, `discussion_posted`, `video_watched`. Union `EventType` đầy đủ (14 giá trị) gồm thêm `logout`, `course_viewed`, `course_enrolled`, `lesson_resumed`, `quiz_abandoned`, `notification_opened` | Bắt buộc |
| FR-6.2 | Mỗi sự kiện lưu: người dùng, loại sự kiện, thời điểm xảy ra (`occurred_at`), khoá/bài liên quan, `duration_seconds` (nếu có), metadata | Bắt buộc |
| FR-6.3 | Sự kiện được gửi **theo lô (batch)** và **không chặn** trải nghiệm người dùng | Bắt buộc |
| FR-6.4 | Sự kiện được lưu append-only; không sửa, không xoá (trừ khi có yêu cầu pháp lý — ngoài phạm vi) | Bắt buộc |
| FR-6.5 | Gửi sự kiện thất bại không làm hỏng luồng học tập của người dùng | Bắt buộc |
| FR-6.6 | Endpoint nhận sự kiện có giới hạn kích thước lô và rate limit | Bắt buộc |
| FR-6.7 | Dữ liệu sự kiện dùng được để tính lại feature tại bất kỳ thời điểm nào (idempotent khi tính lại) | Bắt buộc |

### FR-7. Dashboard analytics

Module: `AnalyticsModule` · Frontend: `pages/analytics/*`, `apis/analytics`

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-7.1 | Giảng viên xem tổng quan một khoá: số học viên, tỉ lệ hoàn thành, điểm trung bình | Bắt buộc |
| FR-7.2 | Dashboard hiển thị **xu hướng theo thời gian** (ngày/tuần) của hoạt động học tập và điểm số | Bắt buộc |
| FR-7.3 | Dashboard so sánh học viên với **trung bình của lớp (cohort)** | Bắt buộc |
| FR-7.4 | Giảng viên xem danh sách học viên **at-risk** kèm lý do ở mức feature, có phân trang | Bắt buộc |
| FR-7.5 | Giảng viên xem được "dòng thời gian" hoạt động của một học viên cụ thể | Nên có |
| FR-7.6 | Dashboard xác định được chủ đề/bài học mà nhiều học viên sai nhất | Nên có |
| FR-7.7 | Số liệu dashboard cập nhật gần thời gian thực (sau khi pipeline chạy) để phục vụ demo | Bắt buộc |
| FR-7.8 | Truy vấn dashboard không được làm chậm API nghiệp vụ (dùng aggregate sẵn/materialized view/cache) | Bắt buộc |
| FR-7.9 | Quản trị viên xem được thống kê toàn hệ thống (số người dùng, khoá học, lượt ghi danh, tỉ lệ hoàn thành) | Bắt buộc |

### FR-8. Phát hiện rủi ro, giải thích và can thiệp (Hướng 5)

Module: `AIGatewayModule`, `AnalyticsModule`, `InterventionModule`, `NotificationModule` ·
Frontend: `pages/analytics/at-risk`, thành phần cảnh báo

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-8.1 | Hệ thống tính được bộ feature hành vi cho từng học viên theo khoá (xem `analytics-ai-design.md`) | Bắt buộc |
| FR-8.2 | Pipeline dự đoán chạy tự động theo lịch (cron/BullMQ) **và** chạy được theo yêu cầu | Bắt buộc |
| FR-8.3 | Kết quả dự đoán gồm `risk_score` (0–1), `risk_level` (`low`/`medium`/`high`), phiên bản model, thời điểm tính | Bắt buộc |
| FR-8.4 | Mỗi dự đoán lưu **giải thích ở mức feature**: feature nào đóng góp nhiều nhất, theo hướng nào | Bắt buộc |
| FR-8.5 | Giải thích hiển thị cho người dùng bằng **câu tiếng Việt dễ hiểu**, không chỉ là con số | Bắt buộc |
| FR-8.6 | NestJS **không chờ** (block) job dự đoán; client theo dõi trạng thái job qua polling hoặc WebSocket | Bắt buộc |
| FR-8.7 | Dự đoán rủi ro không được làm chậm hay làm hỏng API học tập | Bắt buộc |
| FR-8.8 | Khi học viên bị gắn cờ, hệ thống tự động gửi thông báo in-app (và email nếu bật) kèm gợi ý nội dung cần xem lại | Bắt buộc |
| FR-8.9 | Giảng viên gửi được tin nhắn can thiệp trực tiếp cho một học viên | Bắt buộc |
| FR-8.10 | Vòng đời can thiệp được theo dõi: `pending` → `sent` → `acknowledged` → `completed` | Bắt buộc |
| FR-8.11 | Mọi dự đoán và can thiệp được ghi audit (ai/khi nào/dựa trên model version nào) | Bắt buộc |
| FR-8.12 | Ngưỡng phân loại rủi ro, tần suất chạy pipeline, kênh gửi thông báo **cấu hình được** từ trang quản trị | Bắt buộc |
| FR-8.13 | Cơ chế chống spam: một học viên không nhận cảnh báo lặp lại trong khoảng thời gian "cooldown" | Bắt buộc |
| FR-8.14 | Model được đánh giá bằng Precision/Recall và so sánh với baseline rule-based | Bắt buộc |
| FR-8.15 | Có bộ dữ liệu mô phỏng theo kịch bản hành vi để chứng minh và đánh giá | Bắt buộc |
| FR-8.16 | Học viên xem được mức độ sẵn sàng của chính mình (không chỉ giảng viên) | Nên có |
| FR-8.17 | Hệ thống gợi ý bài cần xem lại dựa trên feature yếu nhất của học viên | Nên có |

> **Ranh giới quan trọng:** hệ thống **không sinh nội dung bài học bằng AI** (ngoài phạm vi). Gợi ý
> ôn tập là **chọn từ nội dung có sẵn** theo luật (rule-based), không phải sinh văn bản mới.

### FR-9. Thông báo

Module: `NotificationModule` · Frontend: chuông thông báo trong `layouts/private/Header`

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-9.1 | Hệ thống có thông báo in-app cho người dùng | Bắt buộc |
| FR-9.2 | Người dùng xem danh sách thông báo của mình, đánh dấu đã đọc | Bắt buộc |
| FR-9.3 | Hệ thống gửi được email cho các sự kiện quan trọng (cảnh báo rủi ro, đặt lại mật khẩu) | Bắt buộc |
| FR-9.4 | Người dùng cấu hình được loại thông báo muốn nhận và kênh nhận | Nên có |
| FR-9.5 | Thông báo rủi ro real-time qua WebSocket | Tuỳ chọn (mặc định polling) |

### FR-10. Quản trị hệ thống

Module: `AdminModule` · Frontend: `pages/admin/*`

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-10.1 | Quản trị viên CRUD người dùng, lọc theo vai trò/trạng thái | Bắt buộc |
| FR-10.2 | Quản trị viên quản lý danh mục và khoá học ở mức toàn hệ thống | Bắt buộc |
| FR-10.3 | Quản trị viên xem và xử lý báo cáo vi phạm nội dung | Bắt buộc |
| FR-10.4 | Quản trị viên cấu hình ngưỡng cảnh báo và tham số pipeline | Bắt buộc |
| FR-10.5 | Hệ thống ghi **audit log** cho các hành động quản trị quan trọng (đổi vai trò, khoá tài khoản, xoá nội dung, đổi cấu hình cảnh báo, gửi can thiệp) | Bắt buộc |
| FR-10.6 | Quản trị viên xem audit log, lọc theo người thực hiện, loại hành động, khoảng thời gian | Bắt buộc |
| FR-10.7 | Quản trị viên xem trạng thái và log của các job AI đã chạy | Bắt buộc |
| FR-10.8 | Hệ thống có health check báo cả tình trạng kết nối database | Đã có |

> FR-10.8 đã tồn tại trong repo: `GET /api/health` trả `{ status, uptimeSeconds, timestamp, database }`.

---

## 4. Yêu cầu phi chức năng

| Mã | Nhóm | Yêu cầu | Cách kiểm chứng |
|---|---|---|---|
| NFR-1 | Hiệu năng | API nghiệp vụ thông thường phản hồi p95 < 300 ms trên dữ liệu mô phỏng chạy local | Đo bằng log/thời gian phản hồi trong test |
| NFR-2 | Hiệu năng | Endpoint dashboard analytics p95 < 500 ms trên dữ liệu mô phỏng (mục tiêu đề xuất — cần chốt con số, xem Q7) | Đo trên tập dữ liệu mô phỏng cố định |
| NFR-3 | Hiệu năng | Ghi nhận sự kiện hành vi **không** làm chậm luồng học tập: client không chờ phản hồi | Kiểm tra bằng test: gửi lô sự kiện với server chậm giả lập |
| NFR-4 | Khả dụng | Job AI nặng không được chặn request của người dùng | Review code + test tích hợp |
| NFR-5 | Bảo mật | Mọi API (trừ đăng ký/đăng nhập/quên mật khẩu/health) yêu cầu xác thực và kiểm tra quyền theo vai trò | Test bảo mật: gọi API không token, sai vai trò |
| NFR-6 | Bảo mật | Học viên không đọc/sửa được dữ liệu của học viên khác (chống IDOR) | Test: dùng token học viên A truy cập dữ liệu học viên B → 403/404 |
| NFR-7 | Bảo mật | Giảng viên chỉ truy cập được dữ liệu khoá mình phụ trách | Test tương tự NFR-6 |
| NFR-8 | Bảo mật | Service FastAPI không truy cập được từ internet; chỉ giao tiếp nội bộ, có xác thực service-to-service | Kiểm tra cấu hình mạng + header xác thực |
| NFR-9 | Bảo mật | Mật khẩu băm một chiều; log không chứa mật khẩu/token | Review code + rà log |
| NFR-10 | Riêng tư | Dữ liệu hành vi học viên được ẩn danh hoá khi đưa sang môi trường huấn luyện/thử nghiệm model | Quy trình trong `analytics-ai-design.md` |
| NFR-11 | Riêng tư | Thông báo cho học viên về việc dữ liệu hành vi được dùng để phân tích (minh bạch) | Có nội dung trong UI/điều khoản |
| NFR-12 | Khả năng bảo trì | Code tuân theo `coding-conventions.md`; lint và build phải xanh trên CI | CI xanh trên PR |
| NFR-13 | Khả năng bảo trì | Mọi module mới có ít nhất test đơn vị cho phần logic chính | Review PR: có file spec |
| NFR-14 | Khả năng mở rộng | FastAPI worker scale được độc lập với NestJS (nhiều instance) | Giải thích trong tài liệu; kiểm chứng bằng tài liệu nếu không demo được |
| NFR-15 | Quan sát được | Hệ thống log lỗi có ngữ cảnh; job AI có trạng thái truy vấn được (`ai_jobs`) | Truy vấn `GET /api/ai/jobs/:id` |
| NFR-16 | Tương thích | UI dùng được trên Chrome/Edge bản mới nhất và hiển thị tốt ở 1366×768 (máy chiếu demo) | Kiểm tra thủ công trước demo |
| NFR-17 | Ngôn ngữ | Toàn bộ text hiển thị cho người dùng là tiếng Việt, có dấu | Kiểm tra thủ công |
| NFR-18 | Vận hành | Có thể deploy lên môi trường demo bằng `deploy/deploy.bat` mà không mất dữ liệu | Chạy deploy ở staging |

Các con số trong NFR-1, NFR-2, NFR-3 là **mục tiêu đề xuất**, chưa được đo. Khi có kết quả đo thật,
cập nhật lại bảng này (không ghi số liệu chưa đo vào báo cáo).

---

## 5. Quy ước giao diện API (áp dụng cho mọi yêu cầu ở §3)

Chi tiết đầy đủ ở `02-specs/api-specification.md`; phần dưới đây là những điều **mọi yêu cầu chức
năng phải tuân theo**, nên đặt ở đây để không bị bỏ qua khi đọc §3.

| # | Quy ước | Ghi chú |
|---|---|---|
| A-1 | Mọi route có tiền tố `/api` | `app.setGlobalPrefix('api')` |
| A-2 | Mọi response dùng envelope `{ error, data, message }` | Sinh tự động bởi interceptor/filter — không tự bọc trong controller |
| A-3 | Thất bại giữ **HTTP status thật** (400/401/403/404/409/429/500), không trả 200 kèm `error: true` | |
| A-4 | `message` **luôn là `string`** (kể cả lỗi validate — mảng lỗi đã được nối bằng `'; '`), **tiếng Việt có dấu** | Đã đúng trong repo |
| A-5 | Danh sách dùng phân trang `page`/`take`, trả `{ items, meta }` với `PageMetaDto` | `PageMetaDto` đã có trong `frontend/src/types/index.ts` |
| A-6 | Field JSON là camelCase, tiếng Anh; ID là UUID dạng string; ngày giờ là ISO 8601 | |
| A-7 | Mọi endpoint (trừ đăng ký/đăng nhập/quên mật khẩu/health) yêu cầu Bearer token và kiểm tra vai trò ở server | NFR-5 |
| A-8 | Endpoint danh sách **bắt buộc** có phân trang và giới hạn số bản ghi; endpoint analytics bắt buộc có khoảng thời gian | Tránh treo DB |
| A-9 | Endpoint ghi nhận sự kiện hành vi nhận **lô** và trả về nhanh, không chặn client | FR-6.3 |
| A-10 | Job AI nặng trả `jobId` ngay; client theo dõi qua polling `GET /api/ai/jobs/:id` (WebSocket là tuỳ chọn) | FR-8.6, X5 |

---

## 6. User story và tiêu chí chấp nhận

Ba user story dưới đây lấy nguyên văn ý từ `proposal.md` §3.2, được viết lại thành tiêu chí
chấp nhận kiểm chứng được (Given–When–Then) để dùng làm test case.

### US-1. Học viên (Student)

> *Là học viên, tôi muốn tìm kiếm và ghi danh khoá học, truy cập tài liệu học tập, làm bài luyện
> tập và theo dõi tiến độ của mình, để tôi tự giám sát việc học và nhận cảnh báo sớm khi bị tụt lại.*

| # | Tiêu chí chấp nhận (Given–When–Then) | Yêu cầu liên quan |
|---|---|---|
| AC-1.1 | **Given** tôi là học viên đã đăng nhập, **When** tôi tìm khoá học theo từ khoá và ghi danh, **Then** khoá học xuất hiện trong danh sách "khoá học của tôi" | FR-2.2, FR-3.1 |
| AC-1.2 | **Given** tôi đã ghi danh, **When** tôi mở một bài học, **Then** tôi thấy được toàn bộ tài liệu đã công khai của bài đó | FR-2.6, FR-2.8 |
| AC-1.3 | **Given** tôi đang học, **When** tôi đánh dấu hoàn thành một bài, **Then** tiến độ của tôi tăng và hệ thống ghi nhận sự kiện `lesson_completed` | FR-3.4, FR-6.1 |
| AC-1.4 | **Given** tôi làm quiz có hẹn giờ, **When** tôi nộp bài, **Then** tôi nhận điểm và xem lại được câu sai | FR-4.5, FR-4.6 |
| AC-1.5 | **Given** tôi đang làm quiz, **When** hết thời gian, **Then** bài được tự động nộp | FR-4.7 |
| AC-1.6 | **Given** tôi đã học một phần, **When** tôi quay lại khoá học, **Then** hệ thống đưa tôi tới bài tôi đang học dở | FR-3.6 |
| AC-1.7 | **Given** tôi có hành vi học tập bất thường (ví dụ không đăng nhập nhiều ngày), **When** pipeline dự đoán chạy, **Then** tôi được gắn cờ rủi ro và nhận thông báo in-app kèm lý do dễ hiểu | FR-8.3, FR-8.5, FR-8.8 |
| AC-1.8 | **Given** tôi đã nhận cảnh báo, **When** tôi mở thông báo, **Then** tôi thấy gợi ý các bài cần ôn | FR-8.17 |
| AC-1.9 | **Given** tôi là học viên A, **When** tôi cố truy cập dữ liệu tiến độ của học viên B, **Then** hệ thống từ chối (403/404) | NFR-6 |

### US-2. Giảng viên (Instructor)

> *Là giảng viên, tôi muốn xem kết quả học tập và các chỉ báo cảnh báo sớm trên dashboard của mình,
> để tôi theo dõi tiến độ và can thiệp kịp thời với những học viên đang gặp khó khăn.*

| # | Tiêu chí chấp nhận | Yêu cầu liên quan |
|---|---|---|
| AC-2.1 | **Given** tôi là giảng viên của khoá X, **When** tôi mở dashboard khoá X, **Then** tôi thấy số học viên, tỉ lệ hoàn thành, điểm trung bình và biểu đồ xu hướng | FR-7.1, FR-7.2 |
| AC-2.2 | **Given** tôi đang xem dashboard, **When** pipeline đã gắn cờ học viên, **Then** danh sách học viên at-risk hiển thị **kèm lý do ở mức feature** | FR-7.4, FR-8.4, FR-8.5 |
| AC-2.3 | **Given** tôi thấy một học viên at-risk, **When** tôi gửi tin nhắn can thiệp, **Then** học viên nhận được thông báo và can thiệp được ghi nhận với trạng thái `sent` | FR-8.9, FR-8.10 |
| AC-2.4 | **Given** tôi là giảng viên khoá X, **When** tôi cố xem dashboard khoá Y (không phụ trách), **Then** hệ thống từ chối | NFR-7 |
| AC-2.5 | **Given** tôi tạo quiz cho một chương, **When** học viên nộp bài, **Then** tôi thấy bài nộp trong danh sách và cho được phản hồi | FR-4.8, FR-4.9 |
| AC-2.6 | **Given** tôi đang soạn nội dung, **When** tôi ẩn một bài học, **Then** học viên không còn thấy bài đó | FR-2.8 |

### US-3. Quản trị viên (Admin)

> *Là quản trị viên, tôi muốn quản lý tài khoản người dùng, danh mục khoá học, báo cáo vi phạm nội dung
> và cấu hình phát hiện rủi ro, để tôi duy trì truy cập an toàn, kiểm duyệt nội dung và quản lý hệ
> thống cảnh báo sớm.*

| # | Tiêu chí chấp nhận | Yêu cầu liên quan |
|---|---|---|
| AC-3.1 | **Given** tôi là admin, **When** tôi đổi vai trò một người dùng, **Then** vai trò được cập nhật và có bản ghi audit log | FR-1.11, FR-10.5 |
| AC-3.2 | **Given** tôi là admin, **When** tôi khoá một tài khoản, **Then** người đó không đăng nhập được | FR-1.10 |
| AC-3.3 | **Given** có báo cáo vi phạm nội dung, **When** tôi xử lý, **Then** trạng thái báo cáo được cập nhật và nội dung bị ẩn/xoá nếu cần | FR-10.3, FR-5.4 |
| AC-3.4 | **Given** tôi là admin, **When** tôi đổi ngưỡng cảnh báo, **Then** cấu hình mới được lưu, có hiệu lực ở lần chạy pipeline sau và được ghi audit log | FR-8.12, FR-10.4, FR-10.5 |
| AC-3.5 | **Given** tôi là admin, **When** tôi mở audit log, **Then** tôi lọc được theo người thực hiện, hành động và khoảng thời gian | FR-10.6 |

---

## 7. Quy tắc nghiệp vụ xuyên suốt

| Mã | Quy tắc | Nguồn |
|---|---|---|
| BR-1 | Hệ thống **bổ trợ**, không thay thế LMS hiện có. Không thiết kế luồng bắt buộc phải thay Moodle. | proposal §1.1 |
| BR-2 | Mọi thao tác ghi dữ liệu đều phải biết **ai** thực hiện (audit cho hành động quản trị và can thiệp). | proposal §3.1, architecture §8 |
| BR-3 | Quyền được kiểm tra ở **tầng API**, không chỉ ở giao diện. Ẩn nút trên UI không phải là biện pháp bảo mật. | NFR-5 |
| BR-4 | Dự đoán rủi ro **chỉ mang tính hỗ trợ**; quyết định cuối cùng thuộc về giảng viên. Không tự động hạ điểm hay chặn quyền học của học viên. | Nguyên tắc đạo đức |
| BR-5 | Dữ liệu hành vi là dữ liệu nhạy cảm: phân quyền, ẩn danh khi huấn luyện, log truy cập. | architecture §8 |
| BR-6 | Không xoá cứng dữ liệu học tập (submissions, learning_events, risk_predictions) — dùng trạng thái/soft delete để giữ khả năng truy vết. | architecture §8 |
| BR-7 | Nội dung chưa công khai (publish = false) không bao giờ lộ ra cho học viên qua bất kỳ endpoint nào. | FR-2.8 |
| BR-8 | Thông báo cảnh báo phải có **cooldown**, không gửi lặp lại liên tục cho cùng một học viên. | FR-8.13 |
| BR-9 | Mọi dự đoán phải lưu kèm phiên bản model để có thể giải trình lại sau này. | FR-8.11, architecture §8 |
| BR-10 | Text trả cho người dùng là tiếng Việt có dấu; định danh trong code là tiếng Anh. | D10 |

---

## 8. Sản phẩm bàn giao

| # | Bàn giao | Ghi chú |
|---|---|---|
| D-1 | Source code backend (NestJS) | Trong repo `UniPrep/`, theo quy ước `coding-conventions.md` |
| D-2 | Source code frontend (React) | Không còn phụ thuộc mock data cho luồng chính |
| D-3 | Service AI (FastAPI) + script sinh dữ liệu mô phỏng | Kèm hướng dẫn chạy |
| D-4 | Bộ dữ liệu mô phỏng + kết quả đánh giá model | Bảng so sánh với baseline |
| D-5 | Migrations + seed script | Tạo được DB từ đầu bằng một lệnh |
| D-6 | Báo cáo cuối + slide + kịch bản demo | Theo lịch tuần 48–50 |
| D-7 | Hướng dẫn cài đặt & chạy | `05-guidelines/local-development.md` và `UniPrep/README.md` |
| D-8 | Bộ tài liệu thiết kế | `docs/` (bộ tài liệu này) |

---

## 9. Rủi ro ở mức yêu cầu

Chỉ liệt kê rủi ro **về yêu cầu/phạm vi**. Rủi ro về tiến độ, kỹ thuật, vận hành nằm ở
`04-plan/implementation-plan.md`.

| # | Rủi ro | Dấu hiệu | Cách xử lý |
|---|---|---|---|
| R-1 | Phạm vi quá rộng so với thời gian (10 tuần, nhóm nhỏ) | Cuối tuần 43 mà Auth + Course chưa xong | Cắt phần tuỳ chọn trước (FR-4.11, FR-4.12, FR-9.4, FR-9.5, FR-2.12, FR-7.6), giữ nguyên phần bắt buộc của Hướng 5 |
| R-2 | **Tài liệu gốc còn mâu thuẫn**: báo cáo/slide trích `architecture.md` (mô tả nền tảng học tiếng Anh) trong khi sản phẩm làm theo `proposal.md` (hỗ trợ học tập nói chung) | Người đọc thấy hai mô tả khác nhau về cùng một sản phẩm; thành viên hiểu sai phạm vi nội dung bài học | Đã chốt theo D14 (`README.md` §3): phạm vi theo proposal, phần luyện nói/viết AI bị loại. Việc còn lại là **sửa `architecture.md` và `architecture_report.md`** cho khớp — xem C-1, C-3 trong `README.md` §6 |
| R-3 | Yêu cầu "giải thích được" bị hiểu thành "chỉ hiện con số" | Demo chỉ có `risk_score`, không có lý do | FR-8.4, FR-8.5 là bắt buộc; đưa vào checklist demo |
| R-4 | Dữ liệu mô phỏng quá "sạch" khiến model trông tốt giả tạo | Độ chính xác ~100% | Thêm nhiễu và persona đa dạng theo `analytics-ai-design.md`; luôn so với baseline |
| R-5 | Yêu cầu mới phát sinh sau tuần 46 | Có yêu cầu ngoài danh sách FR | Từ chối hoặc đưa vào "phần mở rộng sau bảo vệ", ghi vào decision log |

---

## 10. Ma trận truy vết yêu cầu

Ánh xạ từ proposal → yêu cầu trong tài liệu này → epic trong kế hoạch triển khai.
(Cột "Epic" tham chiếu `04-plan/implementation-plan.md`.)

### 9.1 Theo phạm vi chức năng của proposal §3.1

| Proposal §3.1 | Nhóm yêu cầu | US / AC | Epic |
|---|---|---|---|
| Đăng ký, đăng nhập/đăng xuất, khôi phục mật khẩu, hồ sơ người dùng | FR-1.1 – FR-1.7 | AC-3.2 | E1, E2 |
| Phân quyền theo vai trò trên toàn bộ API (Student/Instructor/Admin) | FR-1.11, BR-3, NFR-5 – NFR-7 | AC-2.4, AC-3.1 | E1, E12 |
| Quản lý trạng thái tài khoản | FR-1.10 | AC-3.2 | E12 |
| Audit log cho hành động quản trị | FR-10.5, FR-10.6 | AC-3.1, AC-3.5 | E12 |
| Danh mục khoá học: tìm kiếm, lọc, phân trang | FR-2.2, FR-2.3 | AC-1.1 | E3 |
| Trang chi tiết khoá học (đề cương, giảng viên, tiên quyết) | FR-2.4 | AC-1.1 | E3 |
| Cấu trúc chương–bài, hỗ trợ text/slide/video | FR-2.5, FR-2.6, FR-2.10 | AC-1.2 | E3 |
| Giảng viên tạo/sửa/publish/ẩn nội dung | FR-2.7, FR-2.8 | AC-2.6 | E3 |
| Ghi danh khoá học | FR-3.1, FR-3.2 | AC-1.1 | E4 |
| Theo dõi tiến độ | FR-3.3 – FR-3.6 | AC-1.3, AC-1.6 | E4 |
| Quiz hẹn giờ + chấm tự động | FR-4.1 – FR-4.7 | AC-1.4, AC-1.5 | E5 |
| Phản hồi của giảng viên trên bài nộp | FR-4.8, FR-4.9 | AC-2.5 | E5 |
| Diễn đàn thảo luận | FR-5.1 – FR-5.6 | – | E6 |
| Telemetry hành vi (thời gian hoàn thành, số lần thử) | FR-6.1 – FR-6.7, FR-4.10 | AC-1.3 | E7 |
| Pipeline phát hiện rủi ro (FastAPI) | FR-8.1 – FR-8.3, FR-8.15 | AC-1.7 | E9 |
| Dashboard analytics có giải thích ở mức feature | FR-7.1 – FR-7.8, FR-8.4, FR-8.5 | AC-2.1, AC-2.2 | E8, E10 |
| Tin nhắn can thiệp trong ứng dụng | FR-8.8 – FR-8.10 | AC-1.7, AC-2.3 | E10 |
| Admin: quản lý người dùng, khoá học, danh mục | FR-10.1, FR-10.2 | AC-3.1 – AC-3.3 | E12 |
| Admin: kiểm duyệt nội dung bị báo cáo | FR-10.3, FR-5.4 | AC-3.3 | E6, E12 |
| Admin: thống kê cơ bản (ghi danh, tỉ lệ hoàn thành) | FR-7.9 | – | E12 |
| Admin: cấu hình phát hiện rủi ro, log hành động | FR-8.12, FR-10.4, FR-10.5 | AC-3.4 | E12 |
| Ngoài phạm vi: live-stream, MFA, thanh toán, sinh nội dung bằng AI | §1.4 | – | – |

### 9.2 Theo tiêu chí demo của proposal §4.3

| Tiêu chí demo | Yêu cầu | AC | Epic |
|---|---|---|---|
| Cập nhật dữ liệu và trực quan hoá **thời gian thực** trên dashboard giảng viên | FR-7.2, FR-7.7, FR-7.8 | AC-2.1 | E8 |
| Phân loại và gắn cờ học viên at-risk **kèm giải thích mức feature** trên dữ liệu mô phỏng | FR-8.2 – FR-8.5, FR-8.15 | AC-1.7, AC-2.2 | E9, E10 |
| Tự động chạy luồng can thiệp (thông báo in-app/email cho học viên) | FR-8.8, FR-8.10, FR-9.1, FR-9.3 | AC-1.7, AC-2.3 | E10, E11 |
| Đánh giá model bằng Precision/Recall so với baseline rule-based | FR-8.14, FR-8.15 | – | E9, E13 |

### 9.3 Theo kế hoạch của proposal §6.1

| Tuần | Nội dung phải hoàn thành theo proposal | Yêu cầu liên quan |
|---|---|---|
| 39 | Chốt yêu cầu, wireframe UI/UX, ERD mức cao, đặc tả API REST, schema DB dùng chung, repo, CI/CD base | Tài liệu `docs/` này, `02-specs/*` |
| 41–43 | Core MVP: Auth, Course/Content, Quiz Engine + prototype Hướng 5 | FR-1, FR-2, FR-4, FR-6, FR-8.1 – FR-8.3 |
| 44 | Tích hợp, test hệ thống, deploy staging, báo cáo giữa kỳ | FR-3, FR-5, FR-7 cơ bản |
| 45–46 | Hoàn thiện MVP, tinh chỉnh logic cảnh báo, sinh & kiểm chứng dữ liệu đánh giá | FR-8.4 – FR-8.17 |
| 47 | Test chức năng/bảo mật/usability/hiệu năng + fix bug | NFR-1 – NFR-18 |
| 48 | Ổn định production, đánh giá độ chính xác model, viết báo cáo cuối + slide + kịch bản demo | FR-8.14 |
| 49–50 | Tổng duyệt demo, xử lý tồn đọng, nộp bàn giao cuối | D-1 – D-8 |

---

## 11. Backlog ưu tiên

Ưu tiên theo MoSCoW. **P0** = nếu thiếu thì không demo được; **P1** = cần cho báo cáo/nghiệm thu;
**P2** = làm nếu còn thời gian; **P3** = để sau bảo vệ.

| Ưu tiên | Hạng mục | Yêu cầu |
|---|---|---|
| P0 | Xác thực + RBAC 3 vai trò, guard ở tầng API | FR-1.1 – FR-1.4, FR-1.8, NFR-5 |
| P0 | Migrations + seed dữ liệu (bỏ phụ thuộc `synchronize`) | D-5, BR-6 |
| P0 | Khoá học → chương → bài → tài liệu, có publish/hide | FR-2.1 – FR-2.11 |
| P0 | Ghi danh + tiến độ + resume | FR-3.1 – FR-3.7 |
| P0 | Quiz + chấm tự động + xem lại lỗi | FR-4.1 – FR-4.10 |
| P0 | Telemetry hành vi theo lô, không chặn UX | FR-6.1 – FR-6.7 |
| P0 | Pipeline rule-based v0 tính rủi ro trên dữ liệu mô phỏng | FR-8.1 – FR-8.3, FR-8.15 |
| P0 | Dashboard: tổng quan + xu hướng + danh sách at-risk **kèm lý do** | FR-7.1, FR-7.2, FR-7.4, FR-8.4, FR-8.5 |
| P0 | Thông báo in-app tự động khi gắn cờ + can thiệp của giảng viên | FR-8.8 – FR-8.10, FR-9.1 |
| P0 | Admin: quản lý người dùng + audit log + cấu hình ngưỡng | FR-10.1, FR-10.4 – FR-10.6 |
| P1 | Queue BullMQ + service FastAPI tách rời | FR-8.6, NFR-4, NFR-8 |
| P1 | Đánh giá model vs baseline (Precision/Recall) | FR-8.14 |
| P1 | Vòng đời can thiệp đầy đủ 4 trạng thái | FR-8.10 |
| P1 | Kiểm thử bảo mật RBAC/IDOR | NFR-6, NFR-7 |
| P1 | Diễn đàn + kiểm duyệt + báo cáo vi phạm | FR-5.1 – FR-5.6, FR-10.3 |
| P1 | Thông báo email (đặt lại mật khẩu, cảnh báo rủi ro) | FR-1.5, FR-9.3 |
| P1 | Migration từ mock data sang API thật ở frontend | FR-2.3, FR-3.1 |
| P2 | So sánh cohort, timeline học viên, chủ đề sai nhiều nhất | FR-7.3, FR-7.5, FR-7.6 |
| P2 | Học viên tự xem mức độ sẵn sàng của mình | FR-8.16 |
| P2 | Gợi ý bài cần xem lại theo feature yếu nhất | FR-8.17 |
| P2 | Cấu hình loại/kênh thông báo | FR-9.4 |
| P2 | Trộn câu hỏi, điều kiện mở quiz, reorder kéo–thả | FR-4.11, FR-4.12, FR-2.12 |
| P3 | WebSocket real-time thay polling | FR-9.5 |
| P3 | Chấm nói/viết bằng AI | Ngoài đường găng (X3) |

---

## 12. Câu hỏi mở

Các điểm chưa chốt. Nhóm cần trả lời trước khi code tới phần liên quan.

| # | Câu hỏi | Ảnh hưởng | Cần chốt trước |
|---|---|---|---|
| Q1 | ~~Số thành viên nhóm và số giờ/tuần mỗi người?~~ **Đã bỏ khỏi tài liệu** (chốt 2026-09-26 — tài liệu kỹ thuật không quản lý con người; xem `README.md` §6.3) | — | — |
| Q2 | Có giữ module mẫu `student` trong codebase hay xoá khi có `UserModule`? | Nhỏ — ảnh hưởng độ rõ ràng của repo | **ĐÃ CHỐT 2026-10-03 (E0):** xoá hẳn trong E0 (module, entity, bảng `students`, trang FE) |
| Q3 | Danh mục khoá học phẳng hay phân cấp nhiều cấp? | Thiết kế `categories` (self-reference) | Khi làm E3 (tuần 39) |
| Q4 | Giới hạn loại tệp và dung lượng upload là bao nhiêu? | FR-2.11, cấu hình lưu trữ | Khi làm E3 |
| Q5 | Diễn đàn là module riêng hay nằm trong `CourseModule`? | Cấu trúc code (xem `README.md` §2.3b) | Khi làm E6 (tuần 41) |
| Q6 | Có làm email thật hay chỉ mô phỏng ghi log? | FR-9.3, FR-1.5 — ảnh hưởng tính "thật" của demo | Trước tuần 44 |
| Q7 | Mục tiêu hiệu năng cụ thể cho endpoint dashboard? | NFR-2 | Khi làm E8 (tuần 44) |
| Q8 | Có dùng OULAD để đánh giá không, hay chỉ dữ liệu mô phỏng tự sinh? | FR-8.15 — khối lượng việc đáng kể | Trước tuần 45 |
| Q9 | Ngưỡng rủi ro khởi điểm và số học viên tối đa gắn cờ mỗi lớp? | FR-8.12, FR-8.13 | Trước tuần 45 |
| Q10 | Có yêu cầu bảo vệ dữ liệu cá nhân nào từ phía trường không? | NFR-10, NFR-11 | Trước khi thu thập dữ liệu thật |
| Q11 | Tên sản phẩm dùng trong báo cáo và UI: giữ **UniPrep** hay dùng tên khác? | Tên hiển thị, tên khoá học demo | Trước tuần 42 |

> **Đã chốt, không còn là câu hỏi mở:**
> - **Định vị sản phẩm** → theo `proposal.md` (D14): nền tảng hỗ trợ học tập, không gắn môn
>   tiếng Anh; loại bỏ phần luyện nói/viết/chấm phát âm bằng AI. Xem `README.md` §1.1 và §3.1 (X3).
> - **State management FE** → Redux Toolkit (D8). Đã sửa trong `frontend/package.json` 2026-09-26.
> - **Tên cột của `BaseEntityCustom`** → đã sửa thành snake_case có ghi rõ `name` (D12).

---

## 13. Phụ lục — Thuật ngữ

| Thuật ngữ | Giải thích |
|---|---|
| **LMS** | Learning Management System — hệ thống quản lý học tập (Moodle, Canvas…). UniPrep bổ trợ, không thay thế. |
| **Hướng 5 / Track 5** | Thành phần nâng cao của đồ án: Learning Analytics và cảnh báo sớm. |
| **Learning analytics** | Phân tích dữ liệu học tập để hiểu và cải thiện việc học. |
| **At-risk learner** | Học viên có nguy cơ chậm tiến độ hoặc không đạt mục tiêu học tập. |
| **Recency** | Khoảng thời gian kể từ lần hoạt động học tập gần nhất. |
| **Cohort** | Nhóm học viên cùng khoá/lớp, dùng làm mốc so sánh. |
| **Feature** | Biến đầu vào của model dự đoán (ví dụ số ngày không đăng nhập). |
| **Explainability** | Khả năng giải thích vì sao model đưa ra một dự đoán. |
| **SHAP** | Phương pháp phân bổ đóng góp của từng feature vào kết quả dự đoán. |
| **Intervention** | Hành động can thiệp với học viên at-risk (thông báo, tin nhắn, gợi ý nội dung cần xem lại). |
| **Baseline** | Mô hình đơn giản làm mốc so sánh (ví dụ rule "điểm dưới X là rủi ro"). |
| **Precision / Recall** | Độ chính xác của dự đoán dương / tỉ lệ phát hiện được các ca dương thật. |
| **Telemetry** | Việc ghi nhận tự động các sự kiện hành vi của người dùng. |
| **Envelope** | Khuôn dạng response thống nhất `{ error, data, message }` của backend. |
| **RBAC** | Role-Based Access Control — phân quyền theo vai trò. |
| **OULAD** | Open University Learning Analytics Dataset — bộ dữ liệu học tập công khai, có thể dùng để đánh giá. |
| **Synthetic data** | Dữ liệu mô phỏng do nhóm tự sinh theo kịch bản hành vi. |
| **Seed** | Dữ liệu mẫu nạp sẵn vào DB để dev/demo. |

---

*Tài liệu này được soạn từ `docs/proposal.md` và `docs/architecture.md`. Khi hai tài liệu đó thay
đổi, cập nhật lại file này — đặc biệt là §10 (ma trận truy vết).*
