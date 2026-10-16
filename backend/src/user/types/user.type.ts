import type { PageMeta } from '../../common/dto/page-meta.dto';
import type { UserRole, UserStatus } from '../../common/types';
import type { UserProfile } from '../../auth/types/authenticated-user.type';

/**
 * Kiểu dữ liệu HTTP của `UserModule` (E2-T1/E2-T2).
 *
 * Ba hình dạng khác nhau là **có chủ đích**, không phải trùng lặp:
 * - `UserProfile` (trong `auth/types/`) — 8 trường trả kèm token ở luồng xác thực, hợp đồng đã chốt
 *   ở E1 và FE đang dùng (`types/user.ts` → `User`), nên không đổi.
 * - `UserDetail` — hồ sơ đầy đủ của **chính mình** (thêm các trường người dùng tự sửa được).
 * - `UserListItem` — một dòng trong bảng quản trị; cố ý **không** có `phone`/`bio`/`dateOfBirth`
 *   (admin chỉ cần dữ liệu để nhận diện và thao tác, không cần đọc hết hồ sơ của mọi người dùng).
 */

/** `GET /api/users/me`, `PATCH /api/users/me`, `GET /api/users/:id`. */
export interface UserDetail extends UserProfile {
	phone: string | null;
	major: string | null;
	bio: string | null;
	studentCode: string | null;
	dateOfBirth: string | null;
}

export interface UserListItem {
	id: string;
	email: string;
	fullName: string;
	role: UserRole;
	status: UserStatus;
	avatarUrl: string | null;
	studentCode: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/** `data` của `GET /api/users` — `items` + `meta` (khớp `PageMetaDto` của FE). */
export interface PaginatedUsers {
	items: UserListItem[];
	meta: PageMeta;
}

/**
 * Trường được phép sắp xếp. Danh sách **đóng** vì `sortBy` đi thẳng vào `ORDER BY`; nếu nhận chuỗi
 * tự do thì đây là lỗ hổng SQL injection (TypeORM không tham số hoá tên cột).
 */
export const USER_SORT_FIELDS = ['createdAt', 'fullName', 'email'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];
