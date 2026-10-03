import { ForbiddenException } from '@nestjs/common';
import type { UserStatus } from '../common/types';
import { AUTH_MESSAGE } from './constants/auth-message.constant';

/**
 * Message chặn đăng nhập theo từng trạng thái tài khoản (E1-T5).
 *
 * Chốt với nhóm: DB giữ tập giá trị `pending | active | suspended | disabled` của
 * database-design.md §3.1.1; chữ "locked" trong implementation-plan E1-T5 và api-specification
 * được hiểu là **nhóm trạng thái không đăng nhập được** (`suspended`/`disabled`) cộng với tài khoản
 * đang bị khoá tạm do đăng nhập sai nhiều lần (`users.locked_until`). Mỗi trường hợp có message
 * riêng thay vì một câu 401 chung chung — đúng DoD "message rõ ràng".
 */
export const ACCOUNT_STATUS_MESSAGE: Record<
	Exclude<UserStatus, 'active'>,
	string
> = {
	pending:
		'Tài khoản của bạn đang chờ kích hoạt. Vui lòng liên hệ quản trị viên.',
	suspended:
		'Tài khoản của bạn đã bị tạm khoá. Vui lòng liên hệ quản trị viên.',
	disabled:
		'Tài khoản của bạn đã bị vô hiệu hoá. Vui lòng liên hệ quản trị viên.',
};

/** Ném `403` nếu tài khoản không ở trạng thái `active`. */
export const assertAccountActive = (status: UserStatus): void => {
	if (status === 'active') return;
	throw new ForbiddenException(ACCOUNT_STATUS_MESSAGE[status]);
};

/**
 * Ném `403` nếu tài khoản **không được phép dùng hệ thống**, xét cả hai cơ chế:
 * 1. `locked_until` còn ở tương lai — khoá tạm do đăng nhập sai nhiều lần;
 * 2. `status` khác `active` — khoá do quản trị viên.
 *
 * Vì sao phải kiểm tra cả hai ở **mọi** cửa vào (đăng nhập, `refresh`, `JwtStrategy`):
 * `failed_login_count`/`locked_until` không đổi `status`, nên nếu chỉ soi `status` thì tài khoản
 * đang bị khoá tạm vẫn `refresh` được để lấy access token mới và tiếp tục dùng hệ thống — đã gặp
 * đúng lỗi này khi kiểm thử E1-T5.
 */
export const assertAccountUsable = (user: {
	status: UserStatus;
	lockedUntil: Date | null;
}): void => {
	if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
		throw new ForbiddenException(AUTH_MESSAGE.accountLocked);
	}

	assertAccountActive(user.status);
};
