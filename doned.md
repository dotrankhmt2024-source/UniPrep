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

## 6. Quản trị viên làm được gì
- Có toàn bộ quyền của giảng viên, cộng thêm:
- **Quản lý người dùng**: tìm, lọc theo vai trò / trạng thái, chuyển trang; **đổi vai trò**; **khoá / mở khoá** tài khoản. Không tự hạ vai trò hay tự khoá chính mình.
- Tạo khoá học: bắt buộc chọn giảng viên phụ trách.

## 7. Chưa có — đừng test mất công
- Chưa gửi email thật; chưa có ảnh đại diện; quản trị viên chưa tạo / sửa / xoá được người dùng.
- Chưa có: danh sách "khoá học của tôi", huỷ đăng ký, đánh dấu hoàn thành bài, phần trăm tiến độ, quiz / bài tập, thảo luận, thông báo, thống kê hay dashboard, cảnh báo học viên yếu.
- Chưa có chức năng bình luận hay đánh giá khoá học.
