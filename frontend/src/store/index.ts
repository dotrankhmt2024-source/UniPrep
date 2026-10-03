import { configureStore } from '@reduxjs/toolkit';
import authReducer from './auth-slice';

/**
 * Redux store của app. Hiện chỉ có slice `auth`.
 *
 * Lưu ý phụ thuộc: file này KHÔNG được import `config/query-method/*` (axios), vì
 * axios lại import `store` để lấy token ⇒ vòng lặp import. Chiều phụ thuộc hợp lệ là
 * `axios → store → slice` (slice không import gì ngoài `@/types`).
 */
export const store = configureStore({
	reducer: {
		auth: authReducer,
	},
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

export default store;
