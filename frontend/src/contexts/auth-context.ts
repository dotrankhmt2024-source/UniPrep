import { createContext, useContext } from 'react';
import type { AuthSession, LoginPayload, RegisterPayload, User } from '@/types';

/**
 * Context của phiên đăng nhập.
 *
 * Redux store vẫn là nguồn chân lý cho token; context này chỉ là lớp tiện dụng cho component:
 * gói sẵn `user` + các hàm đăng nhập/đăng ký/đăng xuất để trang không phải tự dispatch.
 *
 * Tách khỏi `auth-provider.tsx` (chỉ export component) để React Fast Refresh hoạt động —
 * cùng cách chia với `contexts/theme.ts` / `contexts/theme-context.tsx`.
 */
export interface AuthContextValue {
	user: User | null;
	isAuthenticated: boolean;
	/** `true` trong lúc đọc phiên từ `localStorage` — dùng để không chớp màn hình đăng nhập. */
	isInitializing: boolean;
	login: (payload: LoginPayload) => Promise<AuthSession | null>;
	register: (payload: RegisterPayload) => Promise<AuthSession | null>;
	logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
	undefined,
);

export const useAuth = (): AuthContextValue => {
	const context = useContext(AuthContext);
	if (!context) throw new Error('useAuth must be used within AuthProvider');

	return context;
};
