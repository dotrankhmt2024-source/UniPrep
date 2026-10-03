import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OwnResource } from '../common/decorators/own-resource.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { UserProfile } from '../auth/types/authenticated-user.type';

/**
 * Endpoint người dùng ở phạm vi E1.
 *
 * Cả hai route đều KHÔNG có `@Public()` nên bị `JwtAuthGuard` toàn cục bảo vệ; quyền chi tiết do
 * `OwnershipGuard` (E1-T6) và `RolesGuard` (E1-T5) quyết định.
 */
@ApiTags('Users')
@Controller('users')
export class UserController {
	constructor(private readonly userService: UserService) {}

	/**
	 * E1-T6 — "tài nguyên" đầu tiên để chứng minh chống IDOR: học viên gọi hồ sơ người khác nhận
	 * `403`, admin gọi được mọi hồ sơ. E2-T2 sẽ mở rộng controller này (danh sách, lọc, đổi vai trò).
	 */
	@Get(':id')
	@UseGuards(OwnershipGuard)
	@OwnResource('id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xem hồ sơ một người dùng (chính chủ hoặc admin)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async getById(
		@Param('id', UUID_V4_PIPE) id: string,
	): Promise<ApiResponseDto<UserProfile>> {
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
	): Promise<ApiResponseDto<UserProfile>> {
		const data = await this.userService.updateStatus(id, dto.status, actor.id);
		return buildSuccess(data, 'Cập nhật trạng thái tài khoản thành công');
	}
}
