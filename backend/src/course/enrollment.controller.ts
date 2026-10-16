import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	Query,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { EnrollmentService } from './enrollment.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import { COURSE_MESSAGE } from './constants/course-message.constant';
import { FindEnrollmentsQueryDto } from './dto/find-enrollments-query.dto';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import type {
	EnrollmentListItem,
	EnrollmentProgress,
	MyEnrollmentSummary,
} from './types/course.type';

/**
 * Ghi danh và tiến độ — phần tạo enrollment được kéo sang E3-T7; các endpoint còn lại thuộc E4.
 *
 * `@Roles('student','admin')` theo ma trận RBAC §6: `teacher` không ghi danh khoá học (✖).
 */
@ApiTags('Enrollments')
@Controller('enrollments')
export class EnrollmentController {
	constructor(private readonly enrollmentService: EnrollmentService) {}

	@Get()
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Danh sách ghi danh theo phạm vi người gọi' })
	@ApiOkResponse({ type: ApiResponseDto })
	async findAll(
		@CurrentUser() actor: AuthUser,
		@Query() query: FindEnrollmentsQueryDto,
	): Promise<
		ApiResponseDto<Awaited<ReturnType<EnrollmentService['findAll']>>>
	> {
		return buildSuccess(await this.enrollmentService.findAll(actor, query));
	}

	@Get(':id/progress')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Tiến độ chi tiết của một ghi danh' })
	@ApiOkResponse({ type: ApiResponseDto })
	async getProgress(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<EnrollmentProgress>> {
		return buildSuccess(await this.enrollmentService.getProgress(id, actor));
	}

	@Get(':id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Chi tiết một ghi danh' })
	@ApiOkResponse({ type: ApiResponseDto })
	async findOne(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<EnrollmentListItem>> {
		return buildSuccess(await this.enrollmentService.findOne(id, actor));
	}

	@Delete(':id')
	@Roles('student', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Huỷ ghi danh của chính mình' })
	@ApiOkResponse({ type: ApiResponseDto })
	async cancel(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ id: string; status: string; updatedAt: Date }>> {
		return buildSuccess(
			await this.enrollmentService.cancel(id, actor),
			'Đã huỷ ghi danh',
		);
	}

	@Post()
	@Roles('student', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Đăng ký khoá học cho chính mình' })
	@ApiCreatedResponse({ type: ApiResponseDto })
	async create(
		@CurrentUser() actor: AuthUser,
		@Body() dto: CreateEnrollmentDto,
	): Promise<ApiResponseDto<MyEnrollmentSummary>> {
		const data = await this.enrollmentService.enroll(actor, dto);

		return buildSuccess(data, COURSE_MESSAGE.enrolled);
	}
}
