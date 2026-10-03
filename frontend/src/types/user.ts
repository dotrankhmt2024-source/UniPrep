/**
 * Kiểu dữ liệu người dùng — đối chiếu `docs/02-specs/database-design.md` §7.1 và
 * `POST /auth/login` trong `docs/02-specs/api-specification.md` §5.3.
 *
 * Không dùng TS `enum`: union type là nguồn chân lý cho tập giá trị (quy ước repo).
 */

import type { PageMetaDto } from './index';

export type UserRole = 'student' | 'teacher' | 'admin';

export type UserStatus = 'pending' | 'active' | 'suspended' | 'disabled';

/** Hồ sơ rút gọn backend trả về trong `data.user` — đúng 8 trường, KHÔNG có `passwordHash`. */
export interface User {
	id: string;
	email: string;
	fullName: string;
	role: UserRole;
	status: UserStatus;
	avatarUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export const USER_ROLE_LABEL: Record<UserRole, string> = {
	student: 'Học viên',
	teacher: 'Giảng viên',
	admin: 'Quản trị viên',
};

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
	pending: 'Chờ kích hoạt',
	active: 'Đang hoạt động',
	suspended: 'Tạm khoá',
	disabled: 'Đã vô hiệu hoá',
};

/**
 * Hồ sơ đầy đủ của **chính mình** — `data` của `GET|PATCH /api/users/me` (§5.4, E2-T1).
 *
 * Mở rộng `User` (8 trường trả kèm token) bằng đúng những trường người dùng tự sửa được, cộng
 * `studentCode`/`dateOfBirth` chỉ đọc. `phone`/`major`/`bio` là `null` khi chưa có hoặc đã bị xoá.
 */
export interface UserDetail extends User {
	phone: string | null;
	major: string | null;
	bio: string | null;
	studentCode: string | null;
	dateOfBirth: string | null;
}

/**
 * Một dòng trong bảng quản trị người dùng — `data.items` của `GET /api/users` (E2-T2).
 *
 * Cố ý **không** có `phone`/`major`/`bio`/`dateOfBirth`: admin cần dữ liệu để nhận diện và thao tác,
 * không cần đọc hết hồ sơ của mọi người dùng.
 */
export interface UserListItem {
	id: string;
	email: string;
	fullName: string;
	role: UserRole;
	status: UserStatus;
	avatarUrl: string | null;
	studentCode: string | null;
	createdAt: string;
	updatedAt: string;
}

/** `data` của `GET /api/users` — `items` + `meta` phân trang (dùng lại `PageMetaDto` của `@/types`). */
export interface PaginatedUsers {
	items: UserListItem[];
	meta: PageMetaDto;
}

/**
 * Body `PATCH /api/users/me`.
 *
 * Phân biệt **bỏ trường** (`undefined` = giữ nguyên) với **`null` = xoá** — backend ghi theo
 * `hasOwnProperty` nên gửi `null` mới xoá được số điện thoại/ngành/giới thiệu.
 * `role`/`status`/`email` không có trong kiểu này vì `whitelist: true` của backend loại bỏ chúng.
 */
export interface UpdateMyProfilePayload {
	fullName?: string;
	phone?: string | null;
	major?: string | null;
	bio?: string | null;
}

/** Body `PATCH /api/users/:id/role` (chỉ admin). */
export interface UpdateUserRolePayload {
	role: UserRole;
}

/** Body `PATCH /api/users/:id/status` (chỉ admin). */
export interface UpdateUserStatusPayload {
	status: UserStatus;
}

/**
 * Trường được phép sắp xếp danh sách người dùng. Danh sách **đóng**, khớp `USER_SORT_FIELDS` của
 * backend (`sortBy` đi thẳng vào `ORDER BY` nên backend chỉ nhận đúng các giá trị này).
 */
export type UserSortField = 'createdAt' | 'fullName' | 'email';

/** Thứ tự sắp xếp — khớp `PAGE_ORDER_VALUES` của backend. */
export type PageOrder = 'asc' | 'desc';

/** Query của `GET /api/users`; mọi trường đều tuỳ chọn, backend mặc định `page=1&take=20`. */
export interface FindUsersParams {
	page?: number;
	take?: number;
	search?: string;
	role?: UserRole;
	status?: UserStatus;
	sortBy?: UserSortField;
	order?: PageOrder;
}
