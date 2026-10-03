import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { toUserProfile } from './user.mapper';
import { TokenService } from '../auth/token.service';
import { AUTH_MESSAGE } from '../auth/constants/auth-message.constant';
import type { UserStatus } from '../common/types';
import type { UserProfile } from '../auth/types/authenticated-user.type';

/**
 * Nghiệp vụ người dùng ở phạm vi E1.
 *
 * E1 chỉ cần hai việc: đọc một người dùng (là "tài nguyên" để chứng minh `OwnershipGuard` chặn
 * IDOR — E1-T6) và đổi trạng thái tài khoản (E1-T5). Danh sách/lọc/phân trang, đổi vai trò, hồ sơ
 * cá nhân thuộc E2-T1/E2-T2 và sẽ được thêm vào chính service này.
 */
@Injectable()
export class UserService {
	constructor(
		@InjectRepository(User)
		private readonly users: Repository<User>,
		private readonly tokenService: TokenService,
	) {}

	async getProfileOrFail(id: string): Promise<UserProfile> {
		const user = await this.users.findOne({ where: { id } });

		if (!user || user.deletedAt) {
			throw new NotFoundException(AUTH_MESSAGE.userNotFound);
		}

		return toUserProfile(user);
	}

	/**
	 * Đổi trạng thái tài khoản (E1-T5). Khi chuyển khỏi `active`, **thu hồi mọi phiên** ngay lập tức:
	 * nếu chỉ đổi cột `status` thì người dùng vẫn giữ được quyền truy cập tới 15 phút nhờ access
	 * token cũ, và có thể gia hạn tiếp bằng refresh token.
	 *
	 * Chặn admin tự khoá chính mình: hệ thống có thể còn đúng một admin, tự khoá là mất đường quản
	 * trị (§ E2-T2 áp dụng quy tắc tương tự cho việc tự hạ vai trò).
	 */
	async updateStatus(
		id: string,
		status: UserStatus,
		actorId: string,
	): Promise<UserProfile> {
		const user = await this.users.findOne({ where: { id } });

		if (!user || user.deletedAt) {
			throw new NotFoundException(AUTH_MESSAGE.userNotFound);
		}

		if (id === actorId && status !== 'active') {
			throw new BadRequestException(
				'Bạn không thể khoá hoặc vô hiệu hoá tài khoản của chính mình.',
			);
		}

		await this.users.update({ id }, { status });

		if (status !== 'active') {
			await this.tokenService.revokeAllForUser(id, 'admin_revoke');
		}

		return this.getProfileOrFail(id);
	}
}
