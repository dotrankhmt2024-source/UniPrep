import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import type { Intervention } from './entities/intervention.entity';
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { InterventionService } from './intervention.service';
import {
	RunPromptInterventionDto,
	type RunPromptInterventionResponse,
} from './dto/run-prompt-intervention.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import type { AuthUser } from '../auth/types/authenticated-user.type';

@ApiTags('Interventions & Early Warning')
@Controller('interventions')
export class InterventionController {
	constructor(private readonly interventionService: InterventionService) {}

	@Post('run-prompt')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({
		summary:
			'Giảng viên nhập prompt và chọn nhóm học viên để chạy hệ thống cảnh báo sớm & can thiệp',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async runPrompt(
		@Body() dto: RunPromptInterventionDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<RunPromptInterventionResponse>> {
		const data = await this.interventionService.runPromptIntervention(
			dto,
			actor,
		);
		return buildSuccess(data);
	}
	@Get('course/:courseId')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Xem lịch sử các lần can thiệp của một khoá học',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async findByCourse(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<Intervention[]>> {
		const data = await this.interventionService.findByCourse(courseId, actor);
		return buildSuccess<Intervention[]>(data);
	}
}
