import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthSession, AuthState, User } from '@/types';

/**
 * Slice phiên đăng nhập. Đây là **nguồn chân lý** cho token trong lúc chạy:
 * axios interceptor đọc token qua `store.getState()`, không đọc lại `localStorage`.
 * `localStorage` chỉ là bản sao bền để tải lại trang (xem `contexts/auth-provider.tsx`).
 */
const initialState: AuthState = {
	user: null,
	accessToken: null,
	refreshToken: null,
};

const authSlice = createSlice({
	name: 'auth',
	initialState,
	reducers: {
		/** Ghi phiên mới sau khi đăng nhập / đăng ký / làm mới token. */
		setCredentials: (
			state,
			action: PayloadAction<
				AuthSession | { accessToken: string; refreshToken: string }
			>,
		) => {
			state.accessToken = action.payload.accessToken;
			state.refreshToken = action.payload.refreshToken;
			if ('user' in action.payload) state.user = action.payload.user;
		},
		/** Xoá sạch phiên (đăng xuất hoặc refresh thất bại). */
		clearCredentials: () => initialState,
		/** Cập nhật hồ sơ người dùng mà không đụng tới token (ví dụ sau `GET /auth/me`). */
		updateUser: (state, action: PayloadAction<User>) => {
			state.user = action.payload;
		},
	},
});

export const { setCredentials, clearCredentials, updateUser } =
	authSlice.actions;

export default authSlice.reducer;
