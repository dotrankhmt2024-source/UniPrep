import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiQuery,
	ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponseDto, buildSuccess } from '../common/dto/api-response.dto';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import { SendTutorMessageDto } from './dto/send-tutor-message.dto';
import { TutorSession } from './entities/tutor-session.entity';
import { TutorStep } from './entities/tutor-step.entity';
import { TutorService, type TutorTurnResult } from './tutor.service';

/**
 * Trợ giảng AI có căn cứ — mọi vai trò đã đăng nhập, chỉ trên khoá học họ được xem
 * (`CourseAccessService.assertCanView`). Mỗi người chỉ thấy cuộc trò chuyện của chính mình.
 */
@ApiTags('Tutor')
@ApiBearerAuth()
@Controller('tutor')
export class TutorController {
	constructor(private readonly tutor: TutorService) {}

	/** `GET /api/tutor/status` — FE dùng để báo "chưa cấu hình" thay vì đợi lỗi khi gửi câu hỏi. */
	@Get('status')
	@ApiOperation({ summary: 'Trạng thái cấu hình trợ giảng AI' })
	@ApiOkResponse({ type: ApiResponseDto })
	status(): ApiResponseDto<{ configured: boolean }> {
		return buildSuccess({ configured: this.tutor.isConfigured });
	}

	@Get('sessions')
	@ApiOperation({ summary: 'Các cuộc trò chuyện gần đây của tôi' })
	@ApiQuery({ name: 'courseId', required: false })
	@ApiOkResponse({ type: ApiResponseDto })
	async list(
		@CurrentUser() actor: AuthUser,
		@Query('courseId', new ParseUUIDPipe({ version: '4', optional: true }))
		courseId?: string,
	): Promise<ApiResponseDto<TutorSession>> {
		return buildSuccess(await this.tutor.listSessions(actor.id, courseId));
	}

	@Get('sessions/:id')
	@ApiOperation({ summary: 'Chi tiết cuộc trò chuyện kèm toàn bộ trajectory' })
	@ApiOkResponse({ type: ApiResponseDto })
	async detail(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<TutorSession & { steps: TutorStep[] }>> {
		return buildSuccess(await this.tutor.getSession(actor.id, id));
	}

	@Delete('sessions/:id')
	@ApiOperation({ summary: 'Xoá cuộc trò chuyện' })
	@ApiOkResponse({ type: ApiResponseDto })
	async remove(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<null>> {
		return buildSuccess(
			await this.tutor.deleteSession(actor.id, id),
			'Đã xoá cuộc trò chuyện',
		);
	}

	/** Có thể mất 10–60 giây: agent gọi model nhiều vòng và tra học liệu trước khi trả lời. */
	@Post('messages')
	@ApiOperation({ summary: 'Gửi câu hỏi cho trợ giảng AI (một lượt agent)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async send(
		@Body() dto: SendTutorMessageDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<TutorTurnResult>> {
		return buildSuccess(await this.tutor.sendMessage(actor, dto));
	}
}
