/**
 * Kiểu dữ liệu người dùng — đối chiếu `docs/02-specs/database-design.md` §7.1 và
 * `POST /auth/login` trong `docs/02-specs/api-specification.md` §5.3.
 *
 * Không dùng TS `enum`: union type là nguồn chân lý cho tập giá trị (quy ước repo).
 */

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
