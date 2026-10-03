# Non-Functional Requirements

## 1. Security

| ID | Requirement |
|---|---|
| NFR-1.1 | Mật khẩu người dùng phải được băm bằng thuật toán bcrypt trước khi lưu vào PostgreSQL. Tất cả các secret keys (JWT secret, DB password) tuyệt đối không lưu cứng trong code mà phải nạp qua biến môi trường (.env) |
| NFR-1.2 | Sử dụng cơ chế JWT (Access Token thời hạn ngắn < 60 phút, Refresh Token) cùng JwtAuthGuard và RolesGuard để bảo vệ các API private theo đúng mô hình RBAC. |
| NFR-1.3 | Các endpoint được bảo vệ phải trả về mã trạng thái HTTP 401 Unauthorized nếu yêu cầu gửi lên thiếu Header Authorization: Bearer token hoặc token không hợp lệ. |
| NFR-1.4 | Các endpoint API dành riêng cho Quản trị viên (Admin) phải trả về mã lỗi HTTP 403 Forbidden khi được gọi bởi tài khoản đã đăng nhập nhưng không có đủ quyền hạn |

## 2. Performance

| ID | Requirement |
|---|---|
| NFR-2.1 | API RESTful đọc/ghi dữ liệu cơ bản (xem danh sách khóa học, nội dung bài học, nộp bài trắc nghiệm) trên NestJS phải phản hồi trong thời gian < 200ms ở điều kiện tải bình thường |
| NFR-2.2 | Thao tác nộp bài trắc nghiệm/luyện tập phải được xử lý và hiển thị trạng thái xác nhận (hoặc kết quả bài thi) cho học viên trong thời gian không quá 1.0 giây. |
| NFR-2.3 | Các tác vụ nặng (như tính toán chỉ số rủi ro cho hàng loạt sinh viên hoặc gửi thông báo) phải được đẩy vào hàng đợi Redis + BullMQ, không được làm tắc nghẽn thread chính của NestJS Backend |

## 3. Reliability

| ID | Requirement |
|---|---|
| NFR-3.1 | Môi trường chạy thử nghiệm/Staging đạt chỉ số Uptime tối thiểu 99% trong suốt quá trình đánh giá và demo |
| NFR-3.2 | Khi dịch vụ PostgreSQL hoặc Redis bị ngắt kết nối tạm thời, Backend NestJS và AI Service phải có cơ chế tự động kết nối lại (Retry Pattern) mà không làm sập (crash) ứng dụng |
| NFR-3.3 | Đáp án trong phiên làm bài trắc nghiệm phải được tự động lưu về Server mỗi 10 giây một lần, kết hợp lưu bản nháp cục bộ trên trình duyệt; đảm bảo nếu xảy ra mất kết nối mạng hoặc sập ứng dụng, sinh viên mất tối đa không quá 10 giây kết quả bài làm. |
| NFR-3.4 | Phiên làm bài trắc nghiệm có tính giờ phải được tự động nộp về hệ thống trong vòng không quá 5 giây kể từ khi hết thời gian; nếu trình duyệt đang kết nối mạng sẽ tự động gửi lệnh nộp bài, trường hợp mất kết nối, một tiến trình chạy ngầm trên Server (Scheduled Job) sẽ tự động chốt và nộp bản nháp được tự động lưu gần nhất |
| NFR-3.5 | Có script sao lưu cơ sở dữ liệu PostgreSQL (Database Dump) tự động định kỳ hằng ngày để đảm bảo không bị mất nhật ký học tập và dữ liệu bài thi. |

## 4. Maintainability

| ID | Requirement |
|---|---|
| NFR-4.1 | Code TypeScript và Python phải vượt qua vòng kiểm tra của ESLint/Pylint trong CI/CD pipeline ) trước khi được phép merge vào nhánh develop hoặc main. |
| NFR-4.2 | Hệ thống Backend phải có các bài kiểm thử tự động (Unit Tests / Integration Tests bằng Jest) cho các module nghiệp vụ lõi (Auth, Chấm điểm trắc nghiệm) |
| NFR-4.3 | Mọi thông số cấu hình (Port, Database URL, Redis Port, JWT Secret) được tách biệt hoàn toàn ra khỏi code và quản lý bằng tệp biến môi trường |

## 5. Scalability

| ID | Requirement |
|---|---|
| NFR-5.1 | Hệ thống Backend có khả năng phục vụ đồng thời tối thiểu 100 người dùng tương tác cùng lúc (xem bài học, nộp bài trắc nghiệm) mà không bị treo dịch vụ hay tràn bộ nhớ RAM. |
| NFR-5.2 | Dịch vụ ai-service được tách rời khỏi Backend chính, cho phép mở rộng (scale) số lượng worker Python độc lập khi khối lượng dữ liệu phân tích học tập phình to |
| NFR-5.3 | Sử dụng Redis Cache để lưu đệm các dữ liệu ít thay đổi nhưng được truy xuất liên tục (danh mục khóa học, đề cương bài học), giúp giảm tối thiểu 50% số lượng truy vấn trực tiếp vào PostgreSQL |
| NFR-5.4 | Tiến trình chấm điểm bài thi được thực hiện bất đồng bộ bên ngoài chu kỳ Request/Response HTTP thông qua hàng đợi công việc bền vững (Redis + BullMQ); đảm bảo công suất chấm điểm có thể điều chỉnh mở rộng độc lập theo số lượng Worker mà không làm suy giảm hiệu năng của API server. |

## 6. Usability

| ID | Requirement |
|---|---|
| NFR-6.1 | Dashboard dành cho Giảng viên hiển thị danh sách sinh viên có nguy cơ rủi ro (HIGH, MEDIUM, LOW) kèm biểu đồ và lý do cảnh báo ngắn gọn (Explainability), giúp giảng viên nắm bắt tình hình trong dưới 1 phút |
| NFR-6.2 | Tối thiểu 80% (4 trên 5) người dùng thử nghiệm lần đầu hoàn thành toàn bộ luồng trải nghiệm (đăng ký tài khoản -> thiết lập hồ sơ -> thực hiện bài học đầu tiên) trong vòng không quá 10 phút mà không cần sự trợ giúp hay hướng dẫn từ bên ngoài. |
| NFR-6.3 | Lỗi xác thực biểu mẫu phải được hiển thị dưới dạng thông điệp dễ hiểu ngay tại từng ô nhập liệu trong vòng không quá 2.0 giây; tuyệt đối không hiển thị mã lỗi thô hay vết lỗi hệ thống (stack traces) trên giao diện |
| NFR-6.4 | Phiên làm bài trắc nghiệm có tính giờ phải hiển thị thông báo cảnh báo trực quan tại hai mốc thời gian còn lại là 5 phút và 1 phút; trong đó thông báo ở mốc 1 phút phải nêu rõ hệ thống sẽ tự động đóng và nộp bài khi hết giờ |

## 7. Auditability

| ID | Requirement |
|---|---|
| NFR-7.1 | Hệ thống tự động ghi lại nhật ký (Audit Log) cho các thao tác nhạy cảm của Admin/Instructor (tạo/xóa tài khoản, khóa người dùng, xuất bản/ẩn khóa học, sửa điểm) |
| NFR-7.2 | Mọi thao tác học tập quan trọng (đăng nhập, thời gian xem bài học, số lần thử trắc nghiệm) được lưu vết dạng sự kiện (Event Logs) để phục vụ kiểm toán và làm dữ liệu đầu vào cho AI |
| NFR-7.3 | Hệ thống Logging của NestJS và FastAPI tuyệt đối không được ghi các thông tin nhạy cảm (như mật khẩu thô, Refresh Token) vào tệp log hệ thống |
| NFR-7.4 | Thay đổi mã nguồn phải được quản lý qua GitHub với commit message rõ ràng, đính kèm Pull Request và Issue tương ứng để đảm bảo tính minh bạch đóng góp của từng thành viên |
