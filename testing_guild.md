# Hướng dẫn kiểm thử thủ công UniPrep

> Chạy lần lượt **admin → giảng viên → học viên** để cùng kiểm tra một khoá học. Tạo khoá riêng có tên dễ nhận
> biết, ví dụ `SMOKE-YYYYMMDD`; không dùng khoá thật của nhóm. Khoá đã có học viên/tiến độ/bài nộp có thể không
> xoá được. Gặp lỗi thì ghi lại: tài khoản, đường dẫn trang, thao tác, kết quả mong đợi, kết quả thực tế, ảnh chụp.

## 0. Chuẩn bị

- [ ] Backend chạy ở `http://localhost:3000` (`cd backend && npm run dev`), frontend ở `http://localhost:5173`
      (`cd frontend && npm run dev`). Swagger: `http://localhost:3000/docs`.
- [ ] Đã chạy migration mới nhất: `cd backend && npm run migration:run` (có bảng `tutor_sessions`, `tutor_steps`
      và migration `AddCatalogLinks` thêm cột `catalog_ref`/`catalog_key`).
- [ ] `backend/.env` có nhóm biến `CATALOG_DB_*` trỏ tới DB đề cương của trường (Supabase, schema `bk_uni`) — cần
      cho mục 7. Thiếu nhóm này thì trang khoá học của học viên báo lỗi "Chưa cấu hình kết nối Catalog".
- [ ] **Nên chạy lại seed trước buổi test** (`cd backend && npm run seed`): dữ liệu demo tính thời gian theo lúc
      chạy seed; seed cũ thì mọi học viên MATH101 đều "vắng lâu" và cùng một mức rủi ro. Seed ghi đè tiến độ của
      tài khoản demo.
- [ ] `backend/.env` có `DEEPSEEK_API_KEY` (cần cho Trợ giảng AI và bản nháp can thiệp do AI soạn).
- [ ] Đã có khoá **GIT101 "Hướng dẫn GitHub"** (20 bài tài liệu GitHub Docs) — dùng để test Trợ giảng AI.
- [ ] Để test nhắc hạn (mục 6.4) mà không phải chờ lâu: thêm vào `backend/.env`
      `NOTIFICATION_REMINDER_INTERVAL_MINUTES=1` rồi khởi động lại backend. Test xong thì xoá dòng này (mặc định 30
      phút). Không đặt `NOTIFICATION_SCHEDULER_ENABLED=false`.

**Tài khoản** (mật khẩu = `SEED_DEMO_PASSWORD` trong `backend/.env`, mặc định `UniPrep@2026`):

| Tài khoản | Vai trò | Ghi chú |
|---|---|---|
| `admin@uniprep.test` | admin | |
| `giangvien1@uniprep.test`, `giangvien2@uniprep.test` | giảng viên | Ở MATH101: một người chủ khoá, người kia chỉ phụ trách lớp `L01` |
| `hocvien@uniprep.test` | học viên | Đã ghi danh MATH101, lớp `L01` |
| `sv0001@example.test` … `sv0030@example.test` | học viên ảo | Có lịch sử học mô phỏng ở MATH101 |

---

## 1. Smoke test luồng cơ bản

### Admin
- [ ] Đăng nhập bằng `admin@uniprep.test`; thấy menu **Quản lý người dùng** và **Soạn nội dung**.
- [ ] Mở **Quản lý người dùng**; tìm học viên theo email, lọc vai trò/trạng thái và chuyển trang.
- [ ] Tạo khoá smoke và chọn `giangvien1@uniprep.test` làm giảng viên phụ trách; xác nhận tạo thành công.
- [ ] Kiểm tra admin không tự hạ vai trò hoặc tự khoá tài khoản của mình.

### Giảng viên
- [ ] Đăng nhập bằng `giangvien1@uniprep.test`; mở **Soạn nội dung** và thấy khoá smoke vừa được phân công.
- [ ] Mở khoá, tạo chương và bài học; nhập nội dung, công bố bài và khoá học.
- [ ] Tạo quiz có ít nhất một câu trắc nghiệm, công bố quiz.
- [ ] Đăng nhập bằng `giangvien2@uniprep.test` ở phiên khác, thử mở/sửa khoá smoke; hệ thống phải báo không phụ trách khoá.
- [ ] Sau khi học viên nộp quiz, giảng viên xem bài nộp, nhập điểm/nhận xét và lưu phản hồi.

### Học viên
- [ ] Đăng nhập bằng một học viên chưa ghi danh khoá smoke, ví dụ `sv0001@example.test`; ở **Danh sách khoá
      học**, chọn tab **Môn học tự mở**, tìm và mở chi tiết khoá.
- [ ] Trước khi ghi danh, thử mở bài học; hệ thống phải yêu cầu ghi danh.
- [ ] Ghi danh khoá học; xác nhận trạng thái đổi thành **Đã đăng ký**, khoá xuất hiện trong **Khoá học của tôi**.
- [ ] Vào học, xem nội dung, đánh dấu hoàn thành; xác nhận phần trăm tiến độ cập nhật và **Tiếp tục học** mở lại đúng bài.
- [ ] Mở quiz, bắt đầu lượt làm, trả lời câu hỏi và nộp; xác nhận có điểm, số câu đúng và phần xem lại đáp án/giải thích.
- [ ] Đăng xuất rồi đăng nhập lại; xác nhận vẫn vào được tài khoản và dữ liệu khoá học/tiến độ còn nguyên.

---

## 2. Huỷ ghi danh rồi đăng ký lại

- [ ] Đăng nhập học viên đã ghi danh khoá smoke; ở **Khoá học của tôi**, huỷ ghi danh khoá đó.
- [ ] Mở trang chi tiết khoá (`/courses/<id>`): phải thấy câu "Bạn đã huỷ đăng ký khoá học này…" và nút
      **Đăng ký lại**; **không** được hiện nút "Vào học".
- [ ] Bấm **Đăng ký lại**: trạng thái thành **Đang học**, hiện lại nút "Vào học", khoá xuất hiện lại trong
      **Khoá học của tôi**, tiến độ cũ vẫn còn.
- [ ] Trong lúc đang ở trạng thái đã huỷ, mở trang bài học: **không** hiện khung "Tiến độ khoá học" và không có
      thông báo lỗi tải tiến độ.

## 3. Hiển thị bài học dạng markdown

- [ ] Ghi danh GIT101, mở một bài, ví dụ **"Clone một repository"**.
- [ ] Nội dung hiển thị có định dạng: tiêu đề mục, danh sách đánh số, khối lệnh (nền xám, giữ xuống dòng), ảnh
      minh hoạ, link bấm được tới `docs.github.com`. **Không** còn ký tự thô như `##`, `**`, `` ``` ``.
- [ ] Hộp ghi chú của tài liệu hiển thị là trích dẫn có nhãn **"Ghi chú:"**, không hiện `[!NOTE]`.
- [ ] Mở một bài của khoá khác soạn bằng trình soạn thảo (HTML): vẫn hiển thị như trước.

## 4. Trợ giảng AI

- [ ] Menu bên trái có **Trợ giảng AI**; mở được bằng mọi vai trò.
- [ ] Học viên: góc trên có **bộ chọn môn** (ô viết tắt mã môn + tên môn + "x/y bài · z%"). Bấm vào → danh sách
      **đúng các môn đang đăng ký** như trang **Khoá học của tôi** (không có môn chưa đăng ký), môn đang chọn có dấu
      ✓, có ô tìm khi nhiều hơn 6 môn, chân danh sách có link **Khoá học của tôi** và **+ Đăng ký thêm môn**.
- [ ] Chọn môn khác: cuộc trò chuyện mới mở trên môn đó, danh sách "Cuộc trò chuyện trước" đổi theo môn.
- [ ] Học viên chưa đăng ký môn nào: bộ chọn ghi "Chưa đăng ký môn nào"; mở danh sách thấy lời nhắc và link đăng ký.
- [ ] Học viên mở link `/tutor?course=<id môn không đăng ký>`: tự chuyển sang môn đầu tiên trong danh sách.
- [ ] Giảng viên/admin: bộ chọn liệt kê các khoá họ xem được (không có thanh tiến độ).
- [ ] Chọn khoá **GIT101**, hỏi: *"Làm sao tạo nhánh mới rồi đẩy lên GitHub?"*. Trong 10–60 giây có câu trả lời
      tiếng Việt, có các số trích dẫn `[1]`, `[2]`… và nhãn **"Có căn cứ"**.
- [ ] Bấm một số trích dẫn: trang cuộn tới thẻ trích dẫn tương ứng. Bấm **Mở bài học** → mở đúng bài; bấm
      **Nguồn gốc** → mở trang GitHub Docs.
- [ ] Hỏi một câu học liệu không có, ví dụ *"GitHub Copilot giá bao nhiêu một tháng?"*: trợ giảng phải nói học
      liệu chưa đề cập, hiện cảnh báo **"Không tìm thấy căn cứ…"** và **không** đưa ra con số.
- [ ] Bấm một câu gợi ý bên dưới câu trả lời: câu đó được gửi tiếp trong cùng cuộc trò chuyện.
- [ ] Tab **Trajectory**: thấy các bước SYSTEM → USER → ASSISTANT → TOOL (`search_materials`…) → ANSWER; bấm vào
      một bước để xem chi tiết, token và thời gian.
- [ ] Tải lại trang: cuộc trò chuyện vẫn còn (chọn lại được ở ô "Cuộc trò chuyện trước"). Bấm **Mới** để mở
      cuộc trò chuyện mới; **Xoá** để xoá cuộc trò chuyện đang xem.
- [ ] Từ trang bài học GIT101, bấm **Hỏi trợ giảng AI**: trang trợ giảng mở sẵn đúng khoá, có thông báo "Đang
      xem bài …", và có câu gợi ý "Tóm tắt giúp mình bài đang xem".
- [ ] Đăng nhập tài khoản khác: không thấy cuộc trò chuyện của tài khoản trước.

## 5. Phân tích học tập & cảnh báo sớm (giảng viên)

Dùng khoá **MATH101** (có 30 học viên mô phỏng). Vào **Soạn nội dung → MATH101 → Phân tích học tập & cảnh báo sớm**.

### 5.1 Dashboard
- [ ] Lần đầu mở có thể mất vài giây (hệ thống tự chạy dự đoán). Sau đó hiện 6 ô chỉ số và 5 biểu đồ có số liệu.
- [ ] Đổi **số tuần** (6/10/16/26) và **lớp**: biểu đồ và bảng cập nhật theo.
- [ ] Rê chuột lên biểu đồ: hiện tooltip có tuần và giá trị. Biểu đồ mức rủi ro có chú giải Thấp / Trung bình / Cao.
- [ ] Bật giao diện tối: biểu đồ vẫn đọc được (chữ, lưới, màu không chìm vào nền).

### 5.2 Dự đoán và giải thích
- [ ] Bấm **Chạy lại dự đoán**: có thông báo "Đã đánh giá N học viên: x cao, y trung bình (… ms)".
- [ ] Bảng **Học viên cần theo dõi**: mỗi dòng có mức rủi ro + điểm, các lý do kèm số liệu cụ thể (ví dụ
      "Không hoạt động 12 ngày", "2/5 bài đã đến hạn chưa hoàn thành"), cột **Đề xuất (ASP)**.
- [ ] Đổi ô sức xử lý (ví dụ 10 → 3): số học viên có đề xuất giảm còn tối đa 3, ưu tiên người có điểm cao hơn.
- [ ] Bấm **Chi tiết** một học viên: thấy lý do, số liệu đầu vào, biểu đồ điểm rủi ro qua các lần chạy, số ngày
      học mỗi tuần, danh sách can thiệp.
- [ ] Bấm **Bộ cảnh báo hoạt động thế nào?**: thấy nguồn dữ liệu hiệu chỉnh (OULAD, CC BY 4.0), bảng số đo
      (AUC, Precision, Recall, F1), trọng số từng luật và các ngưỡng.

### 5.3 Phản ứng với hành vi học
- [ ] Đăng nhập `hocvien@uniprep.test`, vào MATH101, mở và hoàn thành 1–2 bài.
- [ ] Quay lại giảng viên, **Chạy lại dự đoán**: với học viên demo, lý do "Không hoạt động …" biến mất hoặc số
      ngày giảm; biểu đồ điểm rủi ro trong **Chi tiết** có thêm một điểm mới.
- [ ] (Nếu bài vừa hoàn thành có hạn và đúng hạn) có thể thấy dòng **"Ngoại lệ: Không tính 'vắng mặt lâu' vì vừa
      hoàn thành bài đúng hạn …"**.

### 5.4 Can thiệp
- [ ] Ở học viên demo (hoặc học viên bất kỳ mức Trung bình/Cao), bấm **Can thiệp**: bản nháp tự hiện, có nhãn
      **"AI soạn · đã kiểm tra số liệu"** hoặc **"Mẫu soạn sẵn"**. Mọi con số trong bản nháp phải khớp số liệu ở
      **Chi tiết** của học viên đó.
- [ ] Đổi loại can thiệp (Nhắc quay lại học / Gợi ý bài cần học bù / Giao mentor kèm): bản nháp được soạn lại;
      loại "Gợi ý bài" có dòng "Bài gợi ý đính kèm".
- [ ] Sửa nội dung rồi **Gửi cho học viên**: thông báo gửi thành công; cột "Lần trước" của học viên đó cập nhật;
      cột **Đề xuất (ASP)** của học viên đó thành "—" (không đề xuất lại trong 7 ngày).
- [ ] Đăng nhập học viên nhận can thiệp, mở chuông thông báo và đọc tin.
- [ ] Quay lại giảng viên, tải lại trang: "Lần trước" ghi **(đã đọc)**; trong **Chi tiết** có "học viên đã đọc".
- [ ] (Chỉ người có quyền truy cập DB) Kiểm tra tự chấm kết quả: chạy
      `UPDATE interventions SET sent_at = now() - interval '8 days' WHERE outcome IS NULL;`, bấm **Chạy lại dự
      đoán**, tải lại trang → vùng **Kết quả can thiệp** và **Chi tiết** hiện Tiến bộ / Không đổi / Xấu đi kèm
      câu giải thích. **Chỉ làm trên DB dev.**

### 5.5 Phân quyền
- [ ] Đăng nhập giảng viên **chỉ phụ trách lớp L01** của MATH101: ô lọc lớp chỉ có L01; bảng chỉ có học viên L01.
- [ ] Giảng viên chủ khoá thấy cả L01 và L02.
- [ ] Học viên mở thẳng `/teacher/courses/<id>/analytics`: bị chặn, có thông báo không có quyền.
- [ ] Giảng viên không phụ trách khoá mở trang phân tích của khoá đó: bị chặn (lỗi 403).

## 6. Thông báo tự động

Mọi thông báo hiện ở **chuông** góc phải trên. Chuông tự cập nhật khoảng **mỗi 60 giây** (khi tab đang mở), nên
không cần tải lại trang — chờ tối đa 1 phút, hoặc bấm mở chuông để tải ngay. Bấm một thông báo: thông báo chuyển
sang đã đọc, badge giảm 1, và mở đúng trang ghi ở từng mục dưới đây.

Dùng khoá smoke ở mục 1 (đã công bố, có ít nhất một học viên đang học, ví dụ `sv0001@example.test`).

### 6.1 Có nội dung mới (`new_content`)
- [ ] Giảng viên tạo bài học mới trong khoá smoke và **công bố** (bật công bố khi tạo, sửa bài bật công bố, hoặc
      bấm Công bố đều được).
- [ ] Học viên đang học khoá thấy thông báo **"Bài học mới: <tên bài>"**; bấm vào → mở đúng trang học của bài đó.
- [ ] Giảng viên **ẩn** rồi **công bố lại** cùng bài: học viên **không** nhận thông báo thứ hai.
- [ ] Giảng viên tạo quiz có hạn nộp, thêm câu hỏi và công bố: học viên thấy **"Bài tập mới: <tên quiz>"**, nội
      dung có **"Hạn nộp: …"** đúng giờ Việt Nam; bấm vào → mở trang làm quiz.
- [ ] Học viên **chưa ghi danh** hoặc **đã huỷ ghi danh** khoá smoke: **không** nhận các thông báo trên.
- [ ] Khoá còn **nháp** hoặc **riêng tư**: công bố bài/quiz không gửi thông báo cho ai.

### 6.2 Đã có điểm (`grade_published`)
- [ ] Tạo bài tập **nộp tệp** (hoặc hỗn hợp), học viên nộp bài. Giảng viên mở bài nộp, nhập điểm + nhận xét, lưu.
- [ ] Học viên thấy **"Đã có điểm bài «…»"**, nội dung có điểm dạng `8.5/10` và câu "Giảng viên có để lại nhận
      xét…" (nếu có nhận xét); bấm vào → mở trang quiz.
- [ ] Giảng viên sửa điểm lần nữa: học viên nhận thêm **"Điểm bài «…» đã được cập nhật"** với điểm mới.
- [ ] Quiz **trắc nghiệm tự chấm**: học viên nộp xong **không** nhận thông báo điểm (điểm đã hiện ngay khi nộp).

### 6.3 Cảnh báo rủi ro cao (`risk_alert`)
Hệ thống chỉ báo khi học viên **vừa chuyển** lên mức **Cao**. Học viên đã ở mức Cao từ lần chạy trước sẽ **không**
nhận lại, nên trên DB đã từng chạy dự đoán cần đặt lại mức cũ trước (**chỉ làm trên DB dev**):

```sql
UPDATE risk_predictions SET risk_level = 'low'
 WHERE is_current AND course_id = (SELECT id FROM courses WHERE code = 'MATH101');
DELETE FROM notifications WHERE notification_type = 'risk_alert';
```

- [ ] Giảng viên vào phân tích MATH101, bấm **Chạy lại dự đoán**. Ghi lại số học viên mức **Cao** trong thông báo
      kết quả.
- [ ] Đăng nhập một học viên mức Cao (xem tên/email trong bảng, ví dụ một tài khoản `svXXXX@example.test`): thấy
      **"Tiến độ học tập của bạn cần được chú ý"**, nội dung nhắc tên khoá MATH101; bấm vào → mở trang khoá học.
- [ ] Học viên mức Thấp / Trung bình: **không** có thông báo này.
- [ ] Giảng viên chủ khoá **và** giảng viên phụ trách lớp: mỗi người nhận một thông báo tổng hợp **"N học viên
      chuyển lên mức rủi ro cao"** (N khớp số mức Cao ở trên, liệt kê tối đa 5 tên); bấm vào → mở trang phân tích
      học tập của MATH101.
- [ ] Bấm **Chạy lại dự đoán** thêm lần nữa: **không** có thông báo mới cho học viên lẫn giảng viên.
- [ ] (Tuỳ chọn, DB dev) Chống báo lại trong 3 ngày: chạy lại câu `UPDATE` ở trên (**không** chạy `DELETE`), rồi
      **Chạy lại dự đoán** → vẫn **không** có thông báo mới vì học viên vừa được báo.
- [ ] (Tuỳ chọn, DB dev) Tắt thông báo: `UPDATE alert_settings SET notify_student = false, notify_instructor = false;`,
      chạy lại cả hai câu SQL ở đầu mục rồi **Chạy lại dự đoán** → không ai nhận thông báo. Xong thì bật lại `true`.

### 6.4 Nhắc hạn (`deadline_reminder`)
Job chạy khoảng 10 giây sau khi backend khởi động, rồi lặp theo chu kỳ (xem mục 0). Nó nhắc những bài **sắp hết
hạn trong 24 giờ tới** mà học viên **chưa nộp / chưa hoàn thành**.

- [ ] Giảng viên tạo quiz trong khoá smoke với hạn nộp **khoảng 2–3 giờ nữa**, công bố.
- [ ] Chờ 1 chu kỳ: học viên chưa nộp thấy **"Sắp hết hạn: <tên quiz>"**, nội dung có giờ hết hạn và "còn khoảng
      N giờ"; bấm vào → mở trang quiz.
- [ ] Học viên **đã nộp** quiz đó trước khi job chạy: **không** nhận nhắc.
- [ ] Chờ thêm vài chu kỳ: mỗi học viên chỉ nhận **một** lần nhắc cho mỗi quiz.
- [ ] Bài học có hạn hoàn thành trong 24 giờ tới: học viên chưa hoàn thành thấy **"Sắp đến hạn hoàn thành:
      <tên bài>"**; học viên đã đánh dấu hoàn thành thì không.
- [ ] Quiz có hạn **hơn 24 giờ nữa** hoặc **đã quá hạn**: không có nhắc.

### 6.5 Thông báo hệ thống (`system`)
Chưa có giao diện; test qua Swagger (`http://localhost:3000/docs`, mục **Notifications**, bấm **Authorize** bằng
access token của admin).

- [ ] Admin gọi `POST /api/notifications/broadcast` với body
      `{ "title": "Bảo trì hệ thống", "body": "Hệ thống bảo trì 22:00–23:00 tối nay.", "roles": ["student"], "link": "/my-courses" }`:
      phản hồi "Đã gửi thông báo tới N người dùng." Một học viên bất kỳ thấy thông báo; bấm vào → mở **Khoá học của
      tôi**. Giảng viên **không** nhận.
- [ ] Gửi với `"courseId": "<id khoá smoke>"`: chỉ học viên đang học khoá đó nhận.
- [ ] Gửi với `"userIds": ["<id một người>"]`: chỉ người đó nhận.
- [ ] Không truyền `roles`/`courseId`/`userIds`: mọi tài khoản đang hoạt động đều nhận.
- [ ] Gọi bằng token giảng viên hoặc học viên: bị chặn (403). `link` không bắt đầu bằng `/` (ví dụ
      `https://…`): lỗi 400.

### 6.6 Đánh dấu đã đọc
- [ ] Bấm **Đánh dấu đã đọc hết**: badge về 0, mọi thông báo chuyển sang đã đọc.
- [ ] Nếu trong đó có tin can thiệp (mục 5.4): quay lại giảng viên, tải lại trang phân tích → "Lần trước" của học
      viên đó ghi **(đã đọc)**, giống như khi bấm đọc từng tin.

## 7. Khoá học từ Catalog, AI soạn bài và bài tập

**Luồng:** học viên thấy toàn bộ môn trong **Catalog** (DB đề cương của trường, UniPrep chỉ đọc) → mở một môn
thì UniPrep tạo khoá học tương ứng (chương = chủ đề, bài = kỹ năng, mỗi chủ đề một bài tập) → ghi danh → mở bài
thì AI soạn nội dung ở **lần đầu** rồi lưu lại → làm bài tập thì AI ra câu hỏi ở **lần đầu** → Trợ giảng AI trả
lời dựa trên các bài đã soạn.

Dùng môn **CO1023 "Hệ thống số"** làm môn chính (đề cương có 7 chủ đề, 57 kỹ năng, nhiều công thức). Nếu CO1023
đã được mở từ trước (DB dev đã có khoá `CO1023`), chọn thêm một môn chưa ai mở, ví dụ **CO2003 "Cấu trúc Dữ liệu
và Giải Thuật"**, để test bước tạo khoá. Mỗi lần AI soạn bài hoặc ra đề là một lần gọi DeepSeek có tính phí;
không bấm lặp lại không cần thiết.

### 7.1 Catalog (qua Swagger)
Mở `http://localhost:3000/docs`, **Authorize** bằng access token của bất kỳ tài khoản nào, mục **Catalog**.

- [ ] `GET /api/catalog/status` trả `configured: true`.
- [ ] `GET /api/catalog/courses?search=CO10`: có danh sách môn kèm `latestVersion`, `versions`; `meta.itemCount`
      là tổng số môn khớp.
- [ ] `GET /api/catalog/courses/CO1023/skill-graph`: `courseRef` là `CO1023@9.1`; có 7 `topics` (Các hệ thống số
      và mã, Đại số Boole…, Bộ đếm và thanh ghi, …), 57 `skills` (ví dụ `CO1023@9.1#3.4`), `outcomes` (L.O.x.y) và
      `assessment` (thí nghiệm 30 / giữa kỳ 20 / cuối kỳ 50).
- [ ] `GET /api/catalog/courses/CO2003/skill-graph`: `edges` có cạnh `cross_course` từ `CO1007` và `CO1027`
      (môn nên học trước).
- [ ] Gọi lại cùng endpoint lần hai: phản hồi nhanh hơn hẳn (cache 5 phút).
- [ ] Mã môn sai (`/api/catalog/courses/CO%201023/outline`) → 400 "Mã môn học không hợp lệ."; môn không tồn tại
      (`CO9999`) → 404; `?version=abc` → 400.
- [ ] (Chỉ người giữ DB) Tạm bỏ trống `CATALOG_DB_HOST` trong `.env`, khởi động lại backend: `status` trả
      `configured: false`, các endpoint Catalog trả 503 "Chưa cấu hình kết nối Catalog…"; các trang khác của app vẫn
      chạy bình thường. Test xong trả lại giá trị cũ.

### 7.2 Danh sách khoá học của học viên (hai tab)
- [ ] Đăng nhập `sv0002@example.test`, mở **Danh sách khoá học** (`/`): có hai tab **Môn học của trường** (mặc
      định) và **Môn học tự mở**.
- [ ] Tab **Môn học của trường**: badge **"… môn học"** (khoảng 2 500 môn), bảng có cột Mã môn, Môn học (tên Việt +
      tên Anh), Tín chỉ, Khoa, Đề cương (`v9.1`…), Ghi danh. Gõ `CO1023` hoặc `hệ thống số` vào ô tìm kiếm: danh
      sách lọc theo mã/tên; đổi trang và số dòng mỗi trang hoạt động.
- [ ] Tab **Môn học tự mở**: chỉ có khoá giảng viên tự tạo (MATH101, PHY101, GIT101, khoá smoke…), có tìm kiếm, lọc
      danh mục/trình độ, sắp xếp như trước. Khoá mở từ Catalog (ví dụ CO1023) **không** xuất hiện ở tab này.
- [ ] Chuyển sang tab **Môn học tự mở** rồi tải lại trang (F5): vẫn ở tab đó (URL có `?tab=custom`). Quay về tab
      đầu: URL bỏ `?tab=`.
- [ ] Đăng nhập giảng viên hoặc admin, mở cùng trang: **không** có tab, vẫn là bảng quản lý mọi khoá học UniPrep
      **như trước** (gồm cả khoá tự tạo và khoá mở từ Catalog).
- [ ] (Swagger) `GET /api/courses?source=manual` chỉ trả khoá tự tạo; `?source=catalog` chỉ trả khoá mở từ Catalog;
      `?source=abc` → 400.

### 7.3 Mở khoá học từ Catalog và ghi danh
- [ ] Ở môn chưa ai mở (ví dụ CO2003), bấm **Xem khoá học**: nút quay vài giây rồi chuyển sang trang chi tiết khoá
      học `/courses/<id>`. Tên khoá là tên môn, mô tả lấy từ mục tiêu môn học.
- [ ] Quay lại danh sách, bấm **Xem khoá học** ở cùng môn lần nữa: mở **đúng khoá cũ** (cùng `<id>`), không tạo
      thêm khoá thứ hai.
- [ ] Trang chi tiết: mục lục có các chương đúng tên chủ đề trong đề cương, mỗi chương có các bài đúng tên kỹ năng
      (với CO1023: 7 chương, 57 bài; chương 1 "Các hệ thống số và mã" có bài "Số và tương tự, DAC và ADC"…).
- [ ] Bấm **Đăng ký**: trạng thái thành **Đã đăng ký**; quay lại danh sách khoá học, cột **Ghi danh** của môn đó
      hiện **Đã đăng ký** và nút đổi thành **Vào học**; khoá xuất hiện trong **Khoá học của tôi**.
- [ ] Đăng nhập học viên khác (`sv0003@example.test`), mở cùng môn: vào đúng khoá đã có, ghi danh độc lập.
- [ ] (Giảng viên/admin) Khoá vừa tạo hiện trong bảng quản lý với trạng thái **Đã xuất bản**; chủ khoá là admin
      (hoặc tài khoản ghi trong `CATALOG_COURSE_OWNER_EMAIL` nếu có đặt).

### 7.4 AI soạn bài học
- [ ] Đã ghi danh, bấm **Vào học**, mở một bài **chưa ai mở**: trang tải khoảng **10–40 giây** (spinner) rồi hiện
      bài. Không bị lỗi hết thời gian chờ.
- [ ] Nội dung là tiếng Việt, đúng chủ đề của bài và có đủ các mục **Mục tiêu**, **Nội dung**, **Ví dụ** (có lời
      giải), **Tóm tắt**, **Câu hỏi tự kiểm tra**. Không lấn sang nội dung của bài khác cùng chương.
- [ ] Tải lại trang, hoặc đăng nhập học viên khác mở cùng bài: hiện **ngay**, nội dung **giống hệt** lần đầu (đã
      lưu, không soạn lại).
- [ ] Hai học viên mở cùng một bài chưa có nội dung **cùng lúc**: cả hai nhận cùng một nội dung; log backend chỉ
      có **một** dòng `Sinh bài CO1023@9.1#…`.
- [ ] Đánh dấu hoàn thành bài: tiến độ khoá học cập nhật như khoá thường.
- [ ] (Chỉ người giữ DB) Tạm bỏ trống `DEEPSEEK_API_KEY`, khởi động lại backend, mở một bài chưa có nội dung: báo
      lỗi rõ ràng "Chưa cấu hình DeepSeek…" (không treo). Bài đã soạn trước đó vẫn mở bình thường. Test xong trả lại
      key.

### 7.5 Hiển thị công thức (LaTeX)
- [ ] Mở bài **"Số và tương tự, DAC và ADC"** (CO1023, chương 1) hoặc một bài của chương 5 "Các phép toán và
      mạch": công thức hiển thị như sách (phân số, chỉ số trên/dưới, ký hiệu Hy Lạp), **không** còn chuỗi thô như
      `$V_{FS}$`, `\frac{…}{…}`, `$$`.
- [ ] Công thức đứng riêng dòng được căn giữa; công thức quá dài thì cuộn ngang trong khung, không tràn trang.
- [ ] Đoạn code trong bài (nếu có) vẫn giữ nguyên ký tự `$`, không bị biến thành công thức.
- [ ] Bật giao diện tối: công thức vẫn đọc được.
- [ ] Mở bài GIT101 "Clone một repository": hiển thị như trước (mục 3), các câu lệnh có `$` không bị biến thành
      công thức.
- [ ] Trợ giảng AI: hỏi một câu cần công thức về CO1023 (ví dụ *"Công thức tính độ phân giải của DAC n bit?"*):
      công thức trong câu trả lời cũng hiển thị đúng.

### 7.6 AI ra bài tập
- [ ] Trong khoá CO1023, mở **Bài tập** (`/courses/<id>/quizzes`): có 7 bài tập tên **"Bài tập: <tên chủ đề>"**.
- [ ] Mở bài tập của chủ đề 1, bấm bắt đầu làm lần đầu: chờ khoảng **5–30 giây** rồi hiện **8 câu** (trắc nghiệm
      một đáp án, nhiều đáp án, Đúng/Sai), nội dung đúng chủ đề.
- [ ] Câu hỏi/phương án có công thức thì công thức hiển thị đúng (như 7.5).
- [ ] Nộp bài: có điểm, số câu đúng; phần xem lại hiện đáp án đúng và **giải thích** cho từng câu.
- [ ] Làm lại lần hai, hoặc học viên khác làm cùng bài tập: **cùng bộ câu hỏi**, hiện ngay (không ra đề lại).
- [ ] Nên mở 2–3 bài của chương trước rồi mới làm bài tập chương đó: câu hỏi bám nội dung các bài đã soạn. (Nếu
      chưa mở bài nào, câu hỏi chỉ dựa trên tên các kỹ năng — không tính là lỗi.)

### 7.6b Quiz theo tiến độ (học viên tự chọn phạm vi)
- [ ] Ở trang **Bài kiểm tra** của một khoá đã ghi danh (khoá Catalog hoặc khoá tự mở), học viên thấy nút **Tạo quiz
      theo tiến độ**; giảng viên/admin **không** thấy nút này.
- [ ] Bấm nút: hộp thoại có dòng **"Đây là tiến độ của bạn: đã học x/y bài. Chọn phần nội dung nằm trong quiz
      này."** kèm thanh tiến độ; bảng bài học nhóm theo chương, cột **Tiến độ** (Đã học / Chưa học) và **Nội dung**
      (Đã có bài / Chỉ có tên bài).
- [ ] Các bài đã đánh dấu hoàn thành được **chọn sẵn**; tích ô của chương thì chọn/bỏ cả chương, chương chọn một phần
      hiện ô gạch ngang.
- [ ] Nút **Chọn bài đã học / Chọn tất cả / Bỏ chọn** hoạt động; chân hộp thoại đếm đúng số bài đã chọn. Không chọn
      bài nào → nút **Tạo quiz** bị khoá; chọn hơn 40 bài → báo vượt giới hạn và khoá nút.
- [ ] Chọn 2–3 bài, số câu **5**, bấm **Tạo quiz**: nút đổi thành "AI đang ra đề…", sau 10–40 giây chuyển sang trang
      làm bài với đúng 5 câu, nội dung thuộc các bài đã chọn (không hỏi bài ngoài phạm vi).
- [ ] Quay lại trang **Bài kiểm tra**: quiz mới có tên **"Quiz theo tiến độ · N bài · <giờ>"** và nhãn **"Quiz của
      bạn · N bài"**; làm/nộp/xem lại đáp án như quiz thường.
- [ ] Đăng nhập học viên khác cùng khoá: **không** thấy quiz đó trong danh sách; mở thẳng `/quizzes/<id>` → báo không
      tìm thấy. Giảng viên cũng không thấy quiz cá nhân trong danh sách bài kiểm tra.
- [ ] Tạo quiz thứ hai với phạm vi khác: hai quiz độc lập, câu hỏi khác nhau.

### 7.7 Trợ giảng AI trên nội dung đã soạn
- [ ] Sau khi đã mở vài bài của CO1023, vào **Trợ giảng AI**, chọn khoá CO1023, hỏi về đúng nội dung một bài đã
      soạn (ví dụ *"DAC và ADC khác nhau thế nào?"*): câu trả lời có trích dẫn `[1]`… và nhãn **"Có căn cứ"**; bấm
      **Mở bài học** → mở đúng bài đã soạn.
- [ ] Hỏi về một kỹ năng **chưa ai mở bài** (ví dụ chương 7 "Mạch ghép kênh/phân kênh"): trợ giảng nói học liệu
      chưa đề cập hoặc chỉ dựa vào tên bài; mở bài đó (để AI soạn) rồi hỏi lại thì có trích dẫn từ bài mới.
- [ ] Từ trang một bài CO1023, bấm **Hỏi trợ giảng AI** → "Tóm tắt giúp mình bài đang xem": tóm tắt đúng bài.

### 7.8 Catalog chỉ được đọc
- [ ] (Chỉ người giữ DB) Sau toàn bộ mục 7, kiểm tra DB đề cương bên Supabase **không** có thay đổi: số dòng
      `bk_uni.course_outlines` vẫn là 2 742, `course_outline_prerequisites` vẫn 1 935. Mọi dữ liệu mới (khoá học,
      bài, câu hỏi, ghi danh, bài nộp) chỉ nằm trong DB của UniPrep.

---

**Không tính là lỗi ở đợt test này:** email thật (thông báo chỉ hiện trong ứng dụng), thông báo đến chậm tối đa
khoảng 1 phút (chuông hỏi lại định kỳ, chưa có realtime), cảnh báo rủi ro chỉ sinh khi có người mở dashboard hoặc
bấm Chạy lại dự đoán (xem dòng về lịch chạy bên dưới), chưa có giao diện admin gửi thông báo hệ thống, avatar, admin tạo/sửa/xoá
tài khoản, thảo luận; trình soạn bài học hiển thị markdown thô khi mở bài dạng markdown để sửa (mới sửa phần
xem bài); dự đoán rủi ro chỉ tự chạy lại khi mở dashboard và kết quả cũ hơn 12 giờ (chưa có lịch chạy định kỳ);
câu trả lời của Trợ giảng AI có thể khác nhau giữa các lần hỏi — chỉ báo lỗi khi trả lời sai so với đoạn trích
dẫn hoặc đưa thông tin không có trong học liệu mà không cảnh báo.

**Riêng mục 7, không tính là lỗi:** một số môn có đề cương nhập không chuẩn nên chương/bài bị tách lạ (ví dụ có
chương tên "Từ chương 1 đến…", hoặc môn rất nhiều chương một bài) — đó là dữ liệu của trường, chỉ báo lỗi nếu môn
CO1023/CO2003/CO2017 bị tách sai; vài môn thuần thực hành/thực tập không mở được ("chưa đủ nội dung để tạo khoá
học"); lần đầu mở mỗi bài phải chờ AI soạn và chỉ có spinner, chưa có dòng "AI đang soạn bài…"; nội dung AI soạn
có thể chưa hoàn hảo về chuyên môn — ghi lại bài sai cụ thể để báo, không chặn đợt test.
