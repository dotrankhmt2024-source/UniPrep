import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import store from '@/store';
import { clearCredentials, setCredentials } from '@/store/auth-slice';
import { getStoredSession, setStoredSession } from '@/utils/token-storage';
import type { DefaultResponseType, TokenPair, User } from '@/types';

/**
 * Axios dùng chung cho toàn bộ tầng `apis/`.
 *
 * Hai interceptor ở đây thực hiện E1-T7:
 * 1. Gắn `Authorization: Bearer <accessToken>` lấy từ Redux store.
 * 2. Bắt 401 → làm mới token **một lần** cho mọi request hỏng đồng thời → chạy lại request gốc.
 *
 * Chiều phụ thuộc: `axiosMethod.config → store` (một chiều). Store tuyệt đối không import file này.
 */

/** Địa chỉ API: đọc một lần để hai instance bên dưới không lệch nhau. */
export const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const axiosMethod = axios.create({
	baseURL: API_BASE_URL,
	timeout: 15000,
});

/** Axios trần cho `/auth/refresh`: không đi qua interceptor ⇒ không thể đệ quy. */
export const refreshClient = axios.create({
	baseURL: API_BASE_URL,
	timeout: 15000,
});

/** Sự kiện phát ra khi phiên hết hạn hẳn; `AuthProvider` lắng nghe để xoá phiên khỏi store. */
export const AUTH_EXPIRED_EVENT = 'uniprep:auth-expired';

/** Các endpoint không được kích hoạt luồng refresh (bản thân chúng là bước xác thực). */
const AUTH_ENDPOINTS_WITHOUT_REFRESH = [
	'/auth/login',
	'/auth/refresh',
	'/auth/register',
];

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
	/** Đánh dấu request đã thử refresh một lần ⇒ không lặp vô hạn. */
	_retry?: boolean;
}

/** Gộp mọi 401 đồng thời vào **một** lời gọi refresh duy nhất. */
let refreshPromise: Promise<string | null> | null = null;

const isAuthEndpointWithoutRefresh = (url?: string): boolean =>
	AUTH_ENDPOINTS_WITHOUT_REFRESH.some(
		(endpoint) => !!url && url.includes(endpoint),
	);

const persistSession = (
	accessToken: string,
	refreshToken: string,
	user: User,
): void => {
	store.dispatch(setCredentials({ accessToken, refreshToken, user }));
	setStoredSession({ accessToken, refreshToken, user });
};

const expireSession = (): void => {
	store.dispatch(clearCredentials());
	window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));

	const { pathname, search } = window.location;
	// Đang ở trang đăng nhập rồi thì không điều hướng vòng quanh.
	if (pathname === '/login') return;

	window.location.assign(
		`/login?redirect=${encodeURIComponent(pathname + search)}`,
	);
};

const requestNewAccessToken = async (): Promise<string | null> => {
	const refreshToken =
		store.getState().auth.refreshToken ?? getStoredSession()?.refreshToken;
	if (!refreshToken) return null;

	try {
		const response = await refreshClient.post<DefaultResponseType<TokenPair>>(
			'/auth/refresh',
			{ refreshToken },
		);
		const tokenPair = response.data?.data;
		if (!tokenPair?.accessToken) return null;

		const currentUser = store.getState().auth.user;
		if (!currentUser) return null;

		persistSession(tokenPair.accessToken, tokenPair.refreshToken, currentUser);
		return tokenPair.accessToken;
	} catch {
		return null;
	}
};

const refreshAccessToken = (): Promise<string | null> => {
	// Gán vào biến module NGAY (đồng bộ) để các 401 đến sau trong cùng một tick dùng lại
	// đúng promise này; `.finally` chỉ chạy sau khi promise kết thúc nên không ghi đè sớm.
	refreshPromise = requestNewAccessToken().finally(() => {
		refreshPromise = null;
	});

	return refreshPromise;
};

axiosMethod.interceptors.request.use((config) => {
	const { accessToken } = store.getState().auth;
	if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);

	return config;
});

axiosMethod.interceptors.response.use(
	(response) => response.data,
	async (error: AxiosError) => {
		const config = error.config as RetriableRequestConfig | undefined;

		if (
			error.response?.status !== 401 ||
			!config ||
			config._retry ||
			isAuthEndpointWithoutRefresh(config.url)
		) {
			return Promise.reject(error);
		}

		config._retry = true;

		const accessToken = await (refreshPromise ?? refreshAccessToken());
		if (!accessToken) {
			expireSession();
			return Promise.reject(error);
		}

		config.headers.set('Authorization', `Bearer ${accessToken}`);
		return axiosMethod.request(config);
	},
);

const joinMessages = (value: unknown): string =>
	Array.isArray(value)
		? value.filter(Boolean).join('; ')
		: typeof value === 'string'
			? value
			: '';

/**
 * Chuẩn hoá lỗi API thành câu tiếng Việt hiển thị được.
 *
 * Backend luôn trả envelope `{ error, data, message }`; `message` có thể là mảng
 * (validate pipe của Nest) nên phải join lại. Chỉ dùng `fallback` khi không có message nào —
 * KHÔNG bịa message mới và KHÔNG hiển thị message tiếng Anh mặc định của axios.
 */
export const getApiErrorMessage = (
	error: unknown,
	fallback = 'Đã có lỗi xảy ra, vui lòng thử lại.',
): string => {
	if (!axios.isAxiosError(error)) {
		return error instanceof Error && error.message ? error.message : fallback;
	}

	const payload = error.response?.data as
		{ message?: unknown } | unknown[] | undefined;
	const message = Array.isArray(payload)
		? joinMessages(payload)
		: joinMessages(payload?.message);

	return message || fallback;
};

export default axiosMethod;
