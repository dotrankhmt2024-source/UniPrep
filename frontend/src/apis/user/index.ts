import { queryMethod } from '@/config';
import type {
	DefaultResponseType,
	FindUsersParams,
	PaginatedUsers,
	UpdateMyProfilePayload,
	UpdateUserRolePayload,
	UpdateUserStatusPayload,
	UserDetail,
} from '@/types';

/**
 * Tầng gọi API của module người dùng (§5.4) — E2-T4 (hồ sơ cá nhân) và E2-T5 (quản lý người dùng).
 *
 * Cùng quy ước với `apis/auth`: `queryMethod` trả về thẳng envelope `{ error, data, message }`
 * (interceptor đã bóc `response.data`), nên các hàm ở đây chỉ khai báo kiểu cho `data`.
 * Trang hiển thị lỗi bằng `getApiErrorMessage(error)` — không đọc `message` ở đây.
 */

/** `GET /api/users/me` — hồ sơ đầy đủ của người đang đăng nhập (mọi vai trò). */
export const getMyProfile = (): Promise<DefaultResponseType<UserDetail>> =>
	queryMethod.get('/users/me') as Promise<DefaultResponseType<UserDetail>>;

/** `PATCH /api/users/me` — chỉ `fullName`/`phone`/`major`/`bio` được backend ghi (whitelist). */
export const updateMyProfile = (
	payload: UpdateMyProfilePayload,
): Promise<DefaultResponseType<UserDetail>> =>
	queryMethod.patch('/users/me', payload) as Promise<
		DefaultResponseType<UserDetail>
	>;

/**
 * `GET /api/users` — danh sách có tìm kiếm/lọc/phân trang, **chỉ admin** (người khác nhận 403).
 *
 * `params` là query string; axios tự bỏ qua các khoá `undefined` nên trang chỉ cần truyền trường
 * đang thực sự lọc, không phải tự dựng chuỗi query.
 */
export const getUsers = (
	params: FindUsersParams = {},
): Promise<DefaultResponseType<PaginatedUsers>> =>
	queryMethod.get('/users', { params }) as Promise<
		DefaultResponseType<PaginatedUsers>
	>;

/** `PATCH /api/users/:id/role` — chỉ admin; không tự hạ vai trò chính mình. */
export const updateUserRole = (
	id: string,
	payload: UpdateUserRolePayload,
): Promise<DefaultResponseType<UserDetail>> =>
	queryMethod.patch(`/users/${id}/role`, payload) as Promise<
		DefaultResponseType<UserDetail>
	>;

/** `PATCH /api/users/:id/status` — chỉ admin; chuyển khỏi `active` sẽ thu hồi mọi phiên của user đó. */
export const updateUserStatus = (
	id: string,
	payload: UpdateUserStatusPayload,
): Promise<DefaultResponseType<UserDetail>> =>
	queryMethod.patch(`/users/${id}/status`, payload) as Promise<
		DefaultResponseType<UserDetail>
	>;
