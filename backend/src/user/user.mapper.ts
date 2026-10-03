import type { User } from './entities/user.entity';
import type { UserProfile } from '../auth/types/authenticated-user.type';

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
