import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OwnResource } from '../common/decorators/own-resource.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import { USER_MESSAGE } from './constants/user-message.constant';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { PaginatedUsers, UserDetail } from './types/user.type';

/**
 * Endpoint người dùng.
 *
 * Không route nào có `@Public()` nên tất cả bị `JwtAuthGuard` toàn cục bảo vệ; quyền chi tiết do
 * `OwnershipGuard` (E1-T6) và `RolesGuard` (E1-T5/E2-T2) quyết định.
 *
 * **Thứ tự khai báo quan trọng:** `me` phải đứng trước `:id`, nếu không Nest khớp `GET /users/me`
 * vào route `:id` và `UUID_V4_PIPE` trả `400` vì `me` không phải UUID.
 */
@ApiTags('Users')
@Controller('users')
export class UserController {
	constructor(private readonly userService: UserService) {}

	/** `GET /api/users/me` (E2-T1) — hồ sơ của chính mình, không cần `OwnershipGuard`. */
	@Get('me')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xem hồ sơ của chính mình' })
	@ApiOkResponse({ type: ApiResponseDto })
	async getMe(
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<UserDetail>> {
		const data = await this.userService.getMyProfile(actor.id);
		return buildSuccess(data);
	}

	/**
	 * `PATCH /api/users/me` (E2-T1). `whitelist: true` ở `ValidationPipe` toàn cục loại bỏ
	 * `role`/`status`/`email` trước khi vào service ⇒ không thể leo thang đặc quyền qua đường này.
	 */
	@Patch('me')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Cập nhật hồ sơ của chính mình' })
	@ApiOkResponse({ type: ApiResponseDto })
	async updateMe(
		@CurrentUser() actor: AuthUser,
		@Body() dto: UpdateMyProfileDto,
	): Promise<ApiResponseDto<UserDetail>> {
		const data = await this.userService.updateMyProfile(actor.id, dto);
		return buildSuccess(data, USER_MESSAGE.profileUpdated);
	}

	/** `GET /api/users` (E2-T2) — chỉ admin. */
	@Get()
	@Roles('admin')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Danh sách người dùng có lọc và phân trang (chỉ admin)',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async findAll(
		@Query() query: FindUsersQueryDto,
	): Promise<ApiResponseDto<PaginatedUsers>> {
		const data = await this.userService.findMany(query);
		return buildSuccess(data);
	}

	/**
	 * E1-T6 — "tài nguyên" đầu tiên để chứng minh chống IDOR: học viên gọi hồ sơ người khác nhận
	 * `403`, admin gọi được mọi hồ sơ.
	 */
	@Get(':id')
	@UseGuards(OwnershipGuard)
	@OwnResource('id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xem hồ sơ một người dùng (chính chủ hoặc admin)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async getById(
		@Param('id', UUID_V4_PIPE) id: string,
	): Promise<ApiResponseDto<UserDetail>> {
		const data = await this.userService.getProfileOrFail(id);
		return buildSuccess(data);
	}

	@Patch(':id/status')
	@Roles('admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Đổi trạng thái tài khoản (chỉ admin)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async updateStatus(
		@Param('id', UUID_V4_PIPE) id: string,
		@Body() dto: UpdateUserStatusDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<UserDetail>> {
		const data = await this.userService.updateStatus(id, dto.status, actor.id);
		return buildSuccess(data, USER_MESSAGE.statusUpdated);
	}

	/** `PATCH /api/users/:id/role` (E2-T2) — chỉ admin; không cho tự hạ vai trò chính mình. */
	@Patch(':id/role')
	@Roles('admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Đổi vai trò người dùng (chỉ admin)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async updateRole(
		@Param('id', UUID_V4_PIPE) id: string,
		@Body() dto: UpdateUserRoleDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<UserDetail>> {
		const data = await this.userService.updateRole(id, dto.role, actor.id);
		return buildSuccess(data, USER_MESSAGE.roleUpdated);
	}
}
