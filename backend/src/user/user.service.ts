import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { toUserDetail, toUserListItem } from './user.mapper';
import { TokenService } from '../auth/token.service';
import { AUTH_MESSAGE } from '../auth/constants/auth-message.constant';
import { USER_MESSAGE } from './constants/user-message.constant';
import { buildPageMeta, toSkip } from '../common/utils/pagination.util';
import type { FindUsersQueryDto } from './dto/find-users-query.dto';
import type { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import type { UserRole, UserStatus } from '../common/types';
import type { UserSortField } from './types/user.type';
import type { PaginatedUsers, UserDetail } from './types/user.type';

/**
 * Cột dùng cho `ORDER BY`. Bảng ánh xạ **đóng** thay vì nội suy `sortBy` vào SQL: tên cột không
 * tham số hoá được, nên nhận chuỗi tự do từ query là lỗ hổng SQL injection.
 */
const SORT_COLUMN: Record<UserSortField, string> = {
	createdAt: 'user.createdAt',
	fullName: 'user.fullName',
	email: 'user.email',
};

/**
 * Nghiệp vụ người dùng.
 *
 * E1 cần hai việc: đọc một người dùng (để chứng minh `OwnershipGuard` chặn IDOR — E1-T6) và đổi
 * trạng thái tài khoản (E1-T5). E2-T1 thêm hồ sơ cá nhân, E2-T2 thêm danh sách/lọc/phân trang và
 * đổi vai trò. **Phạm vi dữ liệu giảng viên (E2-T3) đã chuyển sang E3** vì `cohorts` cần bảng
 * `courses` (E3-T1).
 */
@Injectable()
export class UserService {
	constructor(
		@InjectRepository(User)
		private readonly users: Repository<User>,
		private readonly tokenService: TokenService,
	) {}

	async getProfileOrFail(id: string): Promise<UserDetail> {
		const user = await this.users.findOne({ where: { id } });

		if (!user || user.deletedAt) {
			throw new NotFoundException(AUTH_MESSAGE.userNotFound);
		}

		return toUserDetail(user);
	}

	/** `GET /api/users/me` (E2-T1). */
	async getMyProfile(userId: string): Promise<UserDetail> {
		return this.getProfileOrFail(userId);
	}

	/**
	 * `PATCH /api/users/me` (E2-T1).
	 *
	 * Chỉ ghi những trường client thực sự gửi (`undefined` = không đổi, `null` = xoá). Dùng
	 * `hasOwnProperty` trên DTO đã qua `whitelist` nên `role`/`status`/`email` không thể tới đây.
	 */
	async updateMyProfile(
		userId: string,
		dto: UpdateMyProfileDto,
	): Promise<UserDetail> {
		const user = await this.users.findOne({ where: { id: userId } });

		if (!user || user.deletedAt) {
			throw new NotFoundException(AUTH_MESSAGE.userNotFound);
		}

		const changes: Partial<User> = {};
		if (dto.fullName !== undefined) changes.fullName = dto.fullName;
		if (dto.phone !== undefined) changes.phone = dto.phone;
		if (dto.major !== undefined) changes.major = dto.major;
		if (dto.bio !== undefined) changes.bio = dto.bio;

		if (Object.keys(changes).length > 0) {
			await this.users.update({ id: userId }, changes);
		}

		return this.getProfileOrFail(userId);
	}

	/**
	 * `GET /api/users` (E2-T2) — danh sách cho quản trị.
	 *
	 * Luôn lọc `deleted_at IS NULL` (bản ghi đã xoá mềm không được xuất hiện trong bảng quản trị) và
	 * luôn thêm khoá phụ `id` vào `ORDER BY`: nếu chỉ sắp theo `createdAt`/`fullName` mà nhiều bản
	 * ghi trùng giá trị thì thứ tự giữa hai trang không xác định, bản ghi có thể xuất hiện hai lần
	 * hoặc bị bỏ sót khi lật trang.
	 */
	async findMany(query: FindUsersQueryDto): Promise<PaginatedUsers> {
		const { page, take, order, search, role, status, sortBy } = query;

		const builder = this.users
			.createQueryBuilder('user')
			.where('user.deletedAt IS NULL');

		if (role) {
			builder.andWhere('user.role = :role', { role });
		}

		if (status) {
			builder.andWhere('user.status = :status', { status });
		}

		if (search) {
			// `LOWER(...) LIKE LOWER(:keyword)` thay vì `ILIKE`: cùng kết quả nhưng không phụ thuộc
			// cú pháp riêng của Postgres, đồng thời khớp cách `AuthService` so email khi đăng nhập.
			builder.andWhere(
				`(LOWER(user.email) LIKE :keyword
					OR LOWER(user.fullName) LIKE :keyword
					OR LOWER(COALESCE(user.studentCode, '')) LIKE :keyword)`,
				{ keyword: `%${search.toLowerCase()}%` },
			);
		}

		const [rows, total] = await builder
			.orderBy(SORT_COLUMN[sortBy], order.toUpperCase() as 'ASC' | 'DESC')
			.addOrderBy('user.id', 'ASC')
			.skip(toSkip(page, take))
			.take(take)
			.getManyAndCount();

		return {
			items: rows.map(toUserListItem),
			meta: buildPageMeta(total, page, take),
		};
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
	): Promise<UserDetail> {
		const user = await this.users.findOne({ where: { id } });

		if (!user || user.deletedAt) {
			throw new NotFoundException(AUTH_MESSAGE.userNotFound);
		}

		if (id === actorId && status !== 'active') {
			throw new BadRequestException(USER_MESSAGE.selfStatusChange);
		}

		await this.users.update({ id }, { status });

		if (status !== 'active') {
			await this.tokenService.revokeAllForUser(id, 'admin_revoke');
		}

		return this.getProfileOrFail(id);
	}

	/**
	 * `PATCH /api/users/:id/role` (E2-T2).
	 *
	 * **Quyền có hiệu lực ngay cả khi không thu hồi phiên:** `JwtStrategy` đọc lại `users` ở mỗi
	 * request và lấy `role` từ DB (không tin claim trong token), nên người vừa bị hạ vai trò mất
	 * quyền ngay ở request kế tiếp. Việc thu hồi refresh token ở đây nhắm vào **trạng thái phiên**:
	 * không có nó, trình duyệt vẫn giữ `user.role` cũ trong store và hiển thị sai menu tới khi access
	 * token hết hạn; thu hồi buộc client đăng nhập lại và nhận đúng vai trò mới.
	 *
	 * Chưa ghi `audit_logs`: theo DoD E2-T2 việc đó thuộc E12-T1 (khi interceptor audit ra đời).
	 */
	async updateRole(
		id: string,
		role: UserRole,
		actorId: string,
	): Promise<UserDetail> {
		const user = await this.users.findOne({ where: { id } });

		if (!user || user.deletedAt) {
			throw new NotFoundException(AUTH_MESSAGE.userNotFound);
		}

		if (id === actorId && role !== 'admin') {
			throw new BadRequestException(USER_MESSAGE.selfRoleDemotion);
		}

		// Không đổi gì thì không thu hồi phiên: thao tác lặp lại (idempotent) không được đăng xuất
		// người dùng khỏi mọi thiết bị.
		if (user.role !== role) {
			await this.users.update({ id }, { role });
			await this.tokenService.revokeAllForUser(id, 'admin_revoke');
		}

		return this.getProfileOrFail(id);
	}
}
