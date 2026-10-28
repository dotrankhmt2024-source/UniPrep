import { Controller, Get, Param, Patch } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { Notification } from './entities/notification.entity';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
	constructor(private readonly notificationService: NotificationService) {}

	@Get()
	@ApiBearerAuth()
	@ApiOperation({
		summary:
			'Lấy danh sách thông báo của người dùng hiện tại kèm số lượng chưa đọc (unreadCount)',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async findMyNotifications(
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ items: Notification[]; unreadCount: number }>> {
		const data = await this.notificationService.findMyNotifications(actor.id);
		return buildSuccess(data);
	}

	@Patch('read-all')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Đánh dấu tất cả thông báo của người dùng hiện tại là đã đọc',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async markAllAsRead(
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ updatedCount: number }>> {
		const data = await this.notificationService.markAllAsRead(actor.id);
		return buildSuccess(data, 'Đã đánh dấu đọc tất cả thông báo.');
	}

	@Patch(':id/read')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Đánh dấu một thông báo cụ thể là đã đọc',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async markAsRead(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<Notification>> {
		const data = await this.notificationService.markAsRead(id, actor.id);
		return buildSuccess(data, 'Đã đánh dấu đọc thông báo.');
	}
}
