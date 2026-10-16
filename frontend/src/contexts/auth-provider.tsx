import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react';
import {
	login as loginRequest,
	logout as logoutRequest,
	register as registerRequest,
} from '@/apis/auth';
import { AUTH_EXPIRED_EVENT } from '@/config/query-method/axiosMethod.config';
import { AuthContext, type AuthContextValue } from './auth-context';
import { clearCredentials, setCredentials } from '@/store/auth-slice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
	clearStoredSession,
	getStoredSession,
	setStoredSession,
} from '@/utils/token-storage';
import type { LoginPayload, RegisterPayload } from '@/types';

/**
 * Quản lý vòng đời phiên đăng nhập (quyết định E1: Redux Toolkit + `localStorage`, KHÔNG httpOnly cookie).
 *
 * Ba nhiệm vụ:
 * 1. **Hydrate** — đọc phiên từ `localStorage` vào store một lần lúc khởi động. Trong lúc đọc,
 *    `isInitializing = true` để `ProtectedRoute` hiện `Spin` thay vì đá người dùng về `/login`.
 * 2. **Đồng bộ** — mỗi khi store đổi, ghi lại `localStorage` (một khoá duy nhất `uniprep.auth`),
 *    hoặc xoá khi đã đăng xuất.
 * 3. **Hết hạn** — lắng nghe `uniprep:auth-expired` do axios phát khi refresh thất bại và xoá phiên.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const dispatch = useAppDispatch();
	const { user, accessToken, refreshToken } = useAppSelector(
		(state) => state.auth,
	);
	const [isInitializing, setIsInitializing] = useState(true);

	useEffect(() => {
		const stored = getStoredSession();
		if (stored) dispatch(setCredentials(stored));

		setIsInitializing(false);
	}, [dispatch]);

	useEffect(() => {
		// Chỉ ghi khi đã hydrate xong: store rỗng lúc đầu là trạng thái tạm, không phải "đã đăng xuất".
		if (isInitializing) return;

		if (accessToken && refreshToken && user) {
			setStoredSession({ accessToken, refreshToken, user });
			return;
		}

		clearStoredSession();
	}, [accessToken, refreshToken, user, isInitializing]);

	useEffect(() => {
		const handleAuthExpired = () => {
			dispatch(clearCredentials());
			clearStoredSession();
		};

		window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
		return () =>
			window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
	}, [dispatch]);

	const login = useCallback(
		async (payload: LoginPayload) => {
			const response = await loginRequest(payload);
			const session = response.data;
			if (!session) return null;

			dispatch(setCredentials(session));
			return session;
		},
		[dispatch],
	);

	const register = useCallback(
		async (payload: RegisterPayload) => {
			const response = await registerRequest(payload);
			const session = response.data;
			if (!session) return null;

			dispatch(setCredentials(session));
			return session;
		},
		[dispatch],
	);

	const logout = useCallback(async () => {
		try {
			// Gửi kèm refresh token để backend thu hồi đúng phiên hiện tại; lỗi mạng vẫn phải đăng xuất được.
			await logoutRequest(refreshToken ?? undefined);
		} catch {
			// Bỏ qua: dù API lỗi thì phía client vẫn phải sạch phiên.
		} finally {
			dispatch(clearCredentials());
			clearStoredSession();
		}
	}, [dispatch, refreshToken]);

	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			isAuthenticated: !!accessToken,
			isInitializing,
			login,
			register,
			logout,
		}),
		[user, accessToken, isInitializing, login, register, logout],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
