import { queryMethod } from '@/config';
import type {
	AuthSession,
	ChangePasswordPayload,
	DefaultResponseType,
	ForgotPasswordPayload,
	LoginPayload,
	RegisterPayload,
	ResetPasswordPayload,
	TokenPair,
	User,
} from '@/types';

/**
 * Tầng gọi API của module xác thực (§5.3).
 *
 * `queryMethod` trả về thẳng envelope `{ error, data, message }` (interceptor đã bóc `response.data`),
 * nên các hàm ở đây chỉ việc khai báo kiểu cho `data` và trả envelope về cho trang.
 * Trang hiển thị lỗi bằng `getApiErrorMessage(error)` — không đọc `message` ở đây để khỏi
 * nuốt mất ngữ cảnh.
 */

export const register = (
	payload: RegisterPayload,
): Promise<DefaultResponseType<AuthSession>> =>
	queryMethod.post('/auth/register', payload) as Promise<
		DefaultResponseType<AuthSession>
	>;

export const login = (
	payload: LoginPayload,
): Promise<DefaultResponseType<AuthSession>> =>
	queryMethod.post('/auth/login', payload) as Promise<
		DefaultResponseType<AuthSession>
	>;

export const refreshToken = (
	token: string,
): Promise<DefaultResponseType<TokenPair>> =>
	queryMethod.post('/auth/refresh', { refreshToken: token }) as Promise<
		DefaultResponseType<TokenPair>
	>;

export const logout = (
	token?: string,
): Promise<DefaultResponseType<{ success: true }>> =>
	queryMethod.post(
		'/auth/logout',
		token ? { refreshToken: token } : {},
	) as Promise<DefaultResponseType<{ success: true }>>;

export const forgotPassword = (
	payload: ForgotPasswordPayload,
): Promise<DefaultResponseType<{ success: true }>> =>
	queryMethod.post('/auth/forgot-password', payload) as Promise<
		DefaultResponseType<{ success: true }>
	>;

export const resetPassword = (
	payload: ResetPasswordPayload,
): Promise<DefaultResponseType<{ success: true }>> =>
	queryMethod.post('/auth/reset-password', payload) as Promise<
		DefaultResponseType<{ success: true }>
	>;

export const changePassword = (
	payload: ChangePasswordPayload,
): Promise<DefaultResponseType<{ success: true }>> =>
	queryMethod.post('/auth/change-password', payload) as Promise<
		DefaultResponseType<{ success: true }>
	>;

export const getMe = (): Promise<DefaultResponseType<User>> =>
	queryMethod.get('/auth/me') as Promise<DefaultResponseType<User>>;
