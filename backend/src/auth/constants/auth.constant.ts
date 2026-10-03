/**
 * Hằng số của luồng xác thực.
 *
 * `LOGIN_MAX_FAILED_ATTEMPTS` / `LOGIN_LOCKOUT_MINUTES` lấy đúng ngưỡng "10 lần/15 phút/tài khoản"
 * trong `docs/02-specs/api-specification.md` §12. Chốt với nhóm: chỉ áp dụng **khoá theo tài khoản**
 * ở E1 (dùng hai cột `users.failed_login_count` / `users.locked_until` đã có sẵn trong schema);
 * rate limit theo **IP** (`429`) để E13-T4 làm cùng bài kiểm thử bảo mật, vì nó cần bộ đếm dùng
 * chung (Redis) mà E1 chưa có.
 */
export const LOGIN_MAX_FAILED_ATTEMPTS = 10;
export const LOGIN_LOCKOUT_MINUTES = 15;

/** Số vòng bcrypt — đọc từ `BCRYPT_SALT_ROUNDS`, mặc định 10 (§5.1). */
export const DEFAULT_BCRYPT_SALT_ROUNDS = 10;

/**
 * Hash bcrypt của một chuỗi ngẫu nhiên, dùng để "đốt" thời gian khi email không tồn tại.
 *
 * Vì sao cần: nếu `login` trả 401 ngay lập tức với email lạ nhưng mất ~100ms với email thật
 * (do phải `bcrypt.compare`), kẻ tấn công đo thời gian phản hồi là biết email nào có trong hệ
 * thống — đúng thứ mà §5.2 yêu cầu không được tiết lộ.
 */
export const DUMMY_PASSWORD_HASH =
	'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
