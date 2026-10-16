import type { BadgeStatus } from '@/components';
import type { UserRole, UserStatus } from '@/types';

/**
 * Ánh xạ vai trò / trạng thái người dùng sang tông màu `Badge` của design system.
 *
 * Vì sao tách khỏi trang: cả trang hồ sơ cá nhân (E2-T4) lẫn trang quản lý người dùng (E2-T5) đều
 * hiển thị hai cột này, và màu phải giống nhau ở hai nơi. Chữ hiển thị vẫn lấy từ
 * `USER_ROLE_LABEL` / `USER_STATUS_LABEL` — file này chỉ quyết định **màu**, không quyết định nhãn.
 */

const ROLE_TONE: Record<UserRole, BadgeStatus> = {
	admin: 'info',
	teacher: 'processing',
	student: 'neutral',
};

const STATUS_TONE: Record<UserStatus, BadgeStatus> = {
	pending: 'warning',
	active: 'success',
	// Tạm khoá là trạng thái cần chú ý ngay; đã vô hiệu hoá là trạng thái "chìm" (xám).
	suspended: 'error',
	disabled: 'neutral',
};

export const getRoleBadgeTone = (role: UserRole): BadgeStatus =>
	ROLE_TONE[role];

export const getStatusBadgeTone = (status: UserStatus): BadgeStatus =>
	STATUS_TONE[status];
