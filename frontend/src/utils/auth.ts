/**
 * Tiện ích dùng chung cho các trang xác thực.
 *
 * Tách khỏi `pages/auth/*` vì cả `login`, `register` và `ProtectedRoute` đều cần, và vì
 * file trang chỉ nên export đúng một component (React Fast Refresh).
 */

/**
 * Đọc tham số `?redirect=` do `ProtectedRoute` (hoặc axios interceptor khi phiên hết hạn) gắn vào.
 *
 * Chỉ chấp nhận đường dẫn nội bộ: `//evil.com` là URL protocol-relative nên phải chặn,
 * nếu không kẻ tấn công có thể lợi dụng để đưa người dùng sang domain khác sau khi đăng nhập.
 */
export const resolveRedirect = (raw: string | null): string => {
	if (!raw) return '/';

	const target = raw.startsWith('/') ? raw : `/${raw}`;

	return target.startsWith('//') ? '/' : target;
};

/**
 * Lỗi 409 của `POST /auth/register` (email đã dùng) phải hiển thị ở đúng field email.
 * Đọc mã trạng thái từ `error.response.status` của axios.
 */
export const isEmailTakenError = (error: unknown): boolean => {
	const status = (error as { response?: { status?: number } }).response?.status;

	return status === 409;
};
