import type { User } from './entities/user.entity';
import type { UserProfile } from '../auth/types/authenticated-user.type';
import type { UserDetail, UserListItem } from './types/user.type';

/**
 * Chuyển entity `User` thành hồ sơ trả ra API.
 *
 * Vì sao là hàm riêng chứ không phải method của `AuthService`: cùng một hồ sơ được trả ở
 * `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (E1) và `GET /users/me`, `PATCH /users/me`
 * (E2-T1). Nếu mỗi service tự map, chỉ cần một nơi quên không loại `passwordHash` là hash lọt ra
 * response — đây chính là lý do danh sách trường được **liệt kê tường minh** thay vì spread entity.
 */
export const toUserProfile = (user: User): UserProfile => ({
	id: user.id,
	email: user.email,
	fullName: user.fullName,
	role: user.role,
	status: user.status,
	avatarUrl: user.avatarUrl,
	createdAt: user.createdAt,
	updatedAt: user.updatedAt,
});

/**
 * Hồ sơ đầy đủ (E2-T1) — `UserProfile` cộng các trường chủ tài khoản được xem/sửa.
 *
 * Vẫn liệt kê tường minh: `passwordHash` có `select: false` nên không lọt qua đường này, nhưng
 * `failedLoginCount`/`lockedUntil`/`deletedAt` thì **có** trong entity và không được phép ra API.
 */
export const toUserDetail = (user: User): UserDetail => ({
	...toUserProfile(user),
	phone: user.phone,
	major: user.major,
	bio: user.bio,
	studentCode: user.studentCode,
	dateOfBirth: user.dateOfBirth,
});

/** Một dòng của `GET /api/users` (E2-T2) — chỉ trường cần cho bảng quản trị. */
export const toUserListItem = (user: User): UserListItem => ({
	id: user.id,
	email: user.email,
	fullName: user.fullName,
	role: user.role,
	status: user.status,
	avatarUrl: user.avatarUrl,
	studentCode: user.studentCode,
	createdAt: user.createdAt,
	updatedAt: user.updatedAt,
});
