/**
 * Lưu phiên đăng nhập trong `localStorage` dưới **một** khoá duy nhất.
 *
 * Vì sao một khoá: access token, refresh token và hồ sơ người dùng luôn đổi cùng nhau,
 * ghi tách rời sẽ tạo ra trạng thái nửa vời khi trình duyệt bị đóng giữa hai lần ghi.
 *
 * Mọi thao tác đều bọc `try/catch`: `localStorage` có thể bị chặn (chế độ riêng tư,
 * `SecurityError` khi cookie bị tắt), khi đó app vẫn chạy với phiên trong bộ nhớ.
 */

import type { AuthSession, User } from '@/types';

export const AUTH_STORAGE_KEY = 'uniprep.auth';

/** Phiên lưu trong `localStorage`: đúng ba trường, không có `tokenType`/`expiresIn` (dẫn xuất được). */
export type StoredAuthSession = Pick<
	AuthSession,
	'accessToken' | 'refreshToken' | 'user'
>;

const USER_ROLES = ['student', 'teacher', 'admin'];
const USER_STATUSES = ['pending', 'active', 'suspended', 'disabled'];

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === 'string' && value.length > 0;

/** Kiểm tra kiểu khi đọc: dữ liệu trong `localStorage` là do người dùng sửa được. */
const isStoredUser = (value: unknown): value is User => {
	if (typeof value !== 'object' || value === null) return false;

	const candidate = value as Partial<User>;

	return (
		isNonEmptyString(candidate.id) &&
		isNonEmptyString(candidate.email) &&
		isNonEmptyString(candidate.fullName) &&
		typeof candidate.role === 'string' &&
		USER_ROLES.includes(candidate.role) &&
		typeof candidate.status === 'string' &&
		USER_STATUSES.includes(candidate.status)
	);
};

const isStoredAuthSession = (value: unknown): value is StoredAuthSession => {
	if (typeof value !== 'object' || value === null) return false;

	const candidate = value as Partial<StoredAuthSession>;

	return (
		isNonEmptyString(candidate.accessToken) &&
		isNonEmptyString(candidate.refreshToken) &&
		isStoredUser(candidate.user)
	);
};

/** Đọc phiên đã lưu; trả `null` khi thiếu, hỏng hoặc `localStorage` bị chặn. */
export const getStoredSession = (): StoredAuthSession | null => {
	try {
		const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
		if (!raw) return null;

		const parsed: unknown = JSON.parse(raw);
		if (!isStoredAuthSession(parsed)) {
			// Dữ liệu cũ/hỏng: dọn luôn để lần sau không phải phân tích lại.
			window.localStorage.removeItem(AUTH_STORAGE_KEY);
			return null;
		}

		return parsed;
	} catch {
		return null;
	}
};

export const setStoredSession = (session: StoredAuthSession): void => {
	try {
		window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
	} catch {
		// Bỏ qua: phiên vẫn sống trong Redux store cho tới khi tải lại trang.
	}
};

export const clearStoredSession = (): void => {
	try {
		window.localStorage.removeItem(AUTH_STORAGE_KEY);
	} catch {
		// Bỏ qua.
	}
};
