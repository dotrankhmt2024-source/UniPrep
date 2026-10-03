/**
 * Union type cho người dùng — nguồn chân lý duy nhất, KHÔNG dùng TS `enum`
 * (xem `docs/03-architecture/coding-conventions.md` §2.2 và
 * `docs/02-specs/database-design.md` §7.1, §7.3).
 */

export type UserRole = 'student' | 'teacher' | 'admin';

export type UserStatus = 'pending' | 'active' | 'suspended' | 'disabled';

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
