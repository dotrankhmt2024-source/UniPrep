import { Body, Controller, Post } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { EnrollmentService } from './enrollment.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import { COURSE_MESSAGE } from './constants/course-message.constant';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { MyEnrollmentSummary } from './types/course.type';

/**
 * Ghi danh — lát cắt tối thiểu của E4-T1 dùng cho E3-T7 (xem `EnrollmentService`).
 *
 * `@Roles('student','admin')` theo ma trận RBAC §6: `teacher` không ghi danh khoá học (✖).
 */
@ApiTags('Enrollments')
@Controller('enrollments')
export class EnrollmentController {
	constructor(private readonly enrollmentService: EnrollmentService) {}

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
