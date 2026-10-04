# UniPrep — những gì đã có để test

> Dành cho người test chưa biết gì về dự án. Đọc hết file này là biết bấm vào đâu và thấy gì.

## 1. Vào hệ thống
- Mở trang web → hiện trang **Đăng nhập**. Chưa đăng nhập thì mọi trang khác đều bị đưa về đây.
- Tài khoản có sẵn (mật khẩu giống nhau: `UniPrep@2026`):
  - `admin@uniprep.test` — quản trị viên
  - `giangvien1@uniprep.test`, `giangvien2@uniprep.test` — giảng viên
  - `hocvien@uniprep.test` — học viên (đã học dở 1 khoá), `sv0001@example.test` … `sv0030@example.test` — 30 học viên khác
- **Đăng ký** tài khoản mới ở trang Đăng ký → vào dùng được ngay (tự động là học viên).
- **Đăng xuất**: bấm tên mình ở góc phải trên → chọn Đăng xuất.
- **Quên mật khẩu**: nhập email → hệ thống **không gửi email**; link đặt lại mật khẩu hiện ra ở cửa sổ đang chạy backend (không xem được thì bỏ qua mục này).
- Sai mật khẩu **10 lần** → tài khoản bị khoá **15 phút**.

## 2. Menu bên trái (tuỳ vai trò)
- **Khoá học** — ai cũng thấy · **Hồ sơ cá nhân** — ai cũng thấy
- **Soạn nội dung** — chỉ giảng viên và quản trị viên
- **Quản lý người dùng** — chỉ quản trị viên

## 3. Hồ sơ cá nhân (mọi vai trò)
- Sửa họ tên, điện thoại, khoa, giới thiệu → **Lưu** → tên ở góc phải đổi ngay, không cần tải lại trang.
- Xoá trắng một ô rồi Lưu = xoá thông tin đó.
- Đổi mật khẩu → hệ thống đưa về trang Đăng nhập, phải đăng nhập lại.

## 4. Học viên làm được gì
- Trang **Khoá học**: gõ để tìm, lọc theo danh mục / trình độ, sắp xếp, chuyển trang. Khoá đã học có nhãn "Đã đăng ký".
- Bấm tên một khoá → trang chi tiết: mô tả, đề cương, điều kiện tiên quyết, danh sách chương và bài (chỉ hiện bài đã công bố).
- Bấm **Đăng ký khoá học** → nút đổi thành "Đã đăng ký" và hiện nút **Vào học**. Bấm đăng ký lần nữa sẽ báo đã đăng ký rồi.
- Khoá có điều kiện tiên quyết mà mình chưa học xong → nút đăng ký bị mờ kèm lý do.
- Bấm **Vào học** → xem bài: mục lục chương/bài bên trái, nội dung bài ở giữa, video phát được, tệp/hình tải được, có nút **Bài trước** / **Bài sau**.
- Chưa đăng ký mà mở bài → báo cần đăng ký khoá học.
- Menu **Khoá học của tôi**: xem các khoá đang học, phần trăm hoàn thành và số bài đã hoàn thành; bấm **Tiếp tục học** để quay lại bài chưa hoàn thành gần nhất.
- Trong bài học, bấm **Đánh dấu hoàn thành** → phần trăm tiến độ cập nhật. Bấm lại không làm tăng tiến độ thêm; bài đã hoàn thành có thể bỏ đánh dấu.
- **Làm quiz mẫu:** đăng nhập `hocvien@uniprep.test` → mở khoá **Giải tích 1 (MATH101)** → bấm **Bài kiểm tra** → chọn **Kiểm tra luyện tập — Giải tích 1**. Quiz mẫu có 5 câu, 15 phút và tối đa 3 lượt.
- Bấm **Bắt đầu làm bài**; dùng **Câu trước** / **Câu tiếp theo** để di chuyển. Đáp án được lưu trên trình duyệt trong lượt làm, nên tải lại trang có thể khôi phục khi attempt còn hạn.
- Bấm **Nộp bài** → thấy điểm, số câu đúng và phần xem lại đáp án/giải thích. Thời gian và số lượt do server kiểm tra; hết giờ thì attempt bị khoá. Gửi tất cả câu bỏ trống bằng cách để lựa chọn rỗng vẫn được chấm 0 điểm.
- Có thể làm lại trong giới hạn lượt của quiz. Tài khoản `hocvien@uniprep.test` là học viên mẫu đã ghi danh MATH101; học viên khác cần đăng ký khoá trước khi thấy quiz.

## 5. Giảng viên làm được gì
- **Soạn nội dung** → danh sách khoá mình phụ trách (kèm khoá đã công bố của người khác): tìm, lọc trạng thái, chuyển trang, **Tạo khoá học**.
- Trên từng khoá: **Công bố** / **Ẩn** / **Xoá** (công bố khi chưa có bài nào sẽ báo lỗi; xoá khoá đã có học viên sẽ báo lỗi).
- Mở một khoá → 5 thẻ:
  - **Thông tin**: sửa rồi Lưu (chỉ lưu ô đã thay đổi)
  - **Điều kiện tiên quyết**: chọn nhiều khoá → Lưu (thay thế danh sách cũ)
  - **Giảng viên phụ trách**: xem danh sách, **Phân công** (dán mã người dùng), **Gỡ** (không gỡ được người phụ trách chính)
  - **Lớp học**: thêm / sửa / xoá lớp; trùng mã lớp hoặc ngày kết thúc trước ngày bắt đầu sẽ báo lỗi
  - **Nội dung**: thêm / sửa / xoá chương và bài; đổi thứ tự bằng mũi tên; soạn nội dung bằng trình soạn thảo (đậm, nghiêng, màu, danh sách, link); công bố hoặc ẩn từng bài; tải học liệu lên và xoá học liệu. Tệp quá 50MB hoặc sai định dạng sẽ báo lỗi rõ ràng.
  - Bài đã có học viên học hoặc đã nộp bài thì **không xoá được** (báo lỗi) — đây là hành vi đúng.
- Sửa khoá của giảng viên khác → báo "Bạn không phụ trách khoá học này."
- **Ngân hàng câu hỏi & bài kiểm tra:** trong trang soạn một khoá, bấm link cùng tên bên dưới thông tin khoá. Tạo quiz bản nháp, nhập tên/thời lượng/số lượt; thêm câu hỏi một đáp án, nhiều đáp án hoặc đúng/sai và đánh dấu đáp án đúng.
- Có thể thêm nhiều câu hỏi, sửa nội dung hoặc xoá câu hỏi bản nháp (có xác nhận). Bấm **Công bố** để học viên đã ghi danh thấy quiz; quiz phải có ít nhất một câu. Sau khi đã có lượt làm, backend khoá sửa cấu trúc để giữ nguyên lịch sử điểm.
- Khi học viên nộp bài, chọn quiz đã công bố để xem danh sách bài nộp; giảng viên có thể nhập điểm và phản hồi rồi bấm **Lưu phản hồi**. Hiện thao tác này chưa phát thông báo cho học viên.

## 6. Quản trị viên làm được gì
- Có toàn bộ quyền của giảng viên, cộng thêm:
- **Quản lý người dùng**: tìm, lọc theo vai trò / trạng thái, chuyển trang; **đổi vai trò**; **khoá / mở khoá** tài khoản. Không tự hạ vai trò hay tự khoá chính mình.
- Tạo khoá học: bắt buộc chọn giảng viên phụ trách.

## 7. Chưa có — đừng test mất công
- Chưa gửi email thật; chưa có ảnh đại diện; quản trị viên chưa tạo / sửa / xoá được người dùng.
- Chưa có: huỷ đăng ký khoá học, thảo luận, chuông/thông báo cho học viên, thống kê/dashboard và cảnh báo học viên yếu.
- Quiz v1 chỉ hỗ trợ câu hỏi trắc nghiệm một đáp án, nhiều đáp án và đúng/sai; chưa có tự luận/trả lời ngắn, autosave đáp án lên server, hoặc trang riêng để học viên xem lại các lần nộp cũ sau khi rời trang kết quả.
- Chưa có chức năng bình luận hay đánh giá khoá học.

## 8. Checklist smoke test E2E

> Chạy lần lượt **admin → giảng viên → học viên** để cùng kiểm tra một khoá học. Dùng tài khoản và mật khẩu ở mục 1. Tạo khoá riêng có tên dễ nhận biết, ví dụ `SMOKE-YYYYMMDD`; không dùng khoá thật của nhóm. Khoá đã có học viên/tiến độ/bài nộp có thể không xoá được.

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
- [ ] Đăng nhập bằng một học viên chưa ghi danh khoá smoke, ví dụ `sv0001@example.test`; tìm và mở chi tiết khoá.
- [ ] Trước khi ghi danh, thử mở bài học; hệ thống phải yêu cầu ghi danh.
- [ ] Ghi danh khoá học; xác nhận trạng thái đổi thành **Đã đăng ký**, khoá xuất hiện trong **Khoá học của tôi**.
- [ ] Vào học, xem nội dung, đánh dấu hoàn thành; xác nhận phần trăm tiến độ cập nhật và **Tiếp tục học** mở lại đúng bài.
- [ ] Mở quiz, bắt đầu lượt làm, trả lời câu hỏi và nộp; xác nhận có điểm, số câu đúng và phần xem lại đáp án/giải thích.
- [ ] Đăng xuất rồi đăng nhập lại; xác nhận vẫn vào được tài khoản và dữ liệu khoá học/tiến độ còn nguyên.

### Kiểm tra phân quyền và kết quả
- [ ] Học viên không thấy menu giảng viên/quản trị; truy cập `/teacher/courses` hoặc `/admin/users` bị chặn/điều hướng về trang chính.
- [ ] Giảng viên không phụ trách khoá không thể sửa nội dung hoặc xem/quản lý bài nộp của khoá đó.
- [ ] Dùng một tài khoản thử nghiệm riêng để admin đổi vai trò và khoá/mở khoá; kiểm tra trạng thái đăng nhập tương ứng, sau đó khôi phục tài khoản về `student` và `active`.
- [ ] Đăng xuất ở từng vai trò; trang riêng tư quay về đăng nhập khi không còn phiên.
- [ ] Đánh dấu **Pass** khi tất cả bước hoàn tất đúng như mô tả; ghi lại vai trò, bước lỗi, thông báo và ảnh chụp nếu có lỗi.

**Không tính là lỗi smoke hiện tại:** email thật, avatar, admin tạo/sửa/xoá tài khoản, huỷ ghi danh, thông báo, dashboard/cảnh báo và thảo luận chưa được hỗ trợ (xem mục 7).
