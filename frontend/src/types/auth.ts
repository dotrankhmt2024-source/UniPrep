/**
 * Kiểu dữ liệu cho luồng xác thực phía frontend — khớp hợp đồng `POST /api/auth/*`
 * (xem `backend/src/auth/types/authenticated-user.type.ts`).
 *
 * Mọi endpoint trả về envelope `{ error, data, message }`; `data` ở đây là phần bên trong.
 */

import type { User } from './user';

export interface RegisterPayload {
	email: string;
	password: string;
	fullName: string;
	/** Chỉ học viên mới có; backend bỏ qua nếu rỗng. */
	studentCode?: string;
}

export interface LoginPayload {
	email: string;
	password: string;
}

export interface ForgotPasswordPayload {
	email: string;
}

export interface ResetPasswordPayload {
	token: string;
	password: string;
}

export interface ChangePasswordPayload {
	currentPassword: string;
	newPassword: string;
}

/** `data` của `POST /auth/refresh`. */
export interface TokenPair {
	accessToken: string;
	refreshToken: string;
	tokenType: 'Bearer';
	expiresIn: number;
}

/** `data` của `POST /auth/register` và `POST /auth/login` (token + hồ sơ người dùng). */
export interface AuthSession extends TokenPair {
	user: User;
}

/** Trạng thái phiên trong Redux store `auth`. */
export interface AuthState {
	user: User | null;
	accessToken: string | null;
	refreshToken: string | null;
}
