/**
 * Đọc TTL dạng chuỗi của biến môi trường (`15m`, `7d`, `30s`, `12h`) thành mili-giây.
 *
 * Vì sao tự parse thay vì dùng thư viện: chỉ cần 4 đơn vị và một chỗ dùng (tính `expires_at` của
 * `password_reset_tokens`), thêm dependency chỉ để đổi chuỗi thành số là không đáng. Nếu giá trị
 * sai định dạng thì trả `fallbackMs` — an toàn hơn là `NaN` (mọi phép so sánh với `NaN` đều sai,
 * token sẽ không bao giờ hết hạn).
 */
export const parseTtlToMs = (value: string | undefined, fallbackMs: number) => {
	if (!value) return fallbackMs;

	const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(value.trim());
	if (!match) return fallbackMs;

	const amount = Number(match[1]);
	const unit = (match[2] ?? 's').toLowerCase();

	const multipliers: Record<string, number> = {
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
	};

	return amount * multipliers[unit];
};

/** TTL mặc định của token đặt lại mật khẩu: 30 phút (§5.1). */
export const PASSWORD_RESET_DEFAULT_TTL_MS = 30 * 60 * 1000;
