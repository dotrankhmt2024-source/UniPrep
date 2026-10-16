import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Put,
	Query,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { CourseService } from './course.service';
import { EnrollmentService } from './enrollment.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PublishCourseDto } from './dto/publish-course.dto';
import { FindCoursesQueryDto } from './dto/find-courses-query.dto';
import { CourseProgressQueryDto } from './dto/course-progress-query.dto';
import { AssignInstructorDto } from './dto/assign-instructor.dto';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { ReplacePrerequisitesDto } from './dto/replace-prerequisites.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import { COURSE_MESSAGE } from './constants/course-message.constant';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { PrerequisiteCourseRef } from './course-eligibility.service';
import type {
	CohortItem,
	CourseDetail,
	CourseInstructorItem,
	PaginatedCourses,
	CourseProgressSummary,
} from './types/course.type';

/** `data` của ba endpoint đổi trạng thái (`publish`/`unpublish`). */
interface CourseStatusPatch {
	id: string;
	status: string;
	updatedAt: Date;
}

/**
 * Khoá học (E3-T1) và điều kiện tiên quyết (E3-T5).
 *
 * **Không route nào có `@Public()`** — cả catalog cũng yêu cầu đăng nhập (yêu cầu của E3), nên mọi
 * endpoint đều có `@ApiBearerAuth()`. Quyền chi tiết theo *dữ liệu* (`draft` của người khác,
 * `private`) do `CourseAccessService` quyết định bên trong service, không biểu diễn được bằng
 * `@Roles`.
 *
 * **Không nhận `userId`/vai trò từ client cho quyết định phân quyền:** mọi thao tác dùng
 * `@CurrentUser()`. `ownerId`/`userId` trong body chỉ là *dữ liệu nghiệp vụ* (ai phụ trách, ai được
 * phân công) và luôn được kiểm tra lại ở service.
 */
@ApiTags('Courses')
@Controller('courses')
export class CourseController {
	constructor(
		private readonly courseService: CourseService,
		private readonly enrollmentService: EnrollmentService,
	) {}

	@Get()
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Danh sách khoá học có tìm kiếm, lọc và phân trang',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async findAll(
		@Query() query: FindCoursesQueryDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<PaginatedCourses>> {
		const data = await this.courseService.findMany(query, actor);
		return buildSuccess(data);
	}

	@Post()
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Tạo khoá học (giảng viên hoặc admin)' })
	@ApiCreatedResponse({ type: ApiResponseDto })
	async create(
		@Body() dto: CreateCourseDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<CourseDetail>> {
		const data = await this.courseService.create(dto, actor);
		return buildSuccess(data, COURSE_MESSAGE.created);
	}

	@Get(':id')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Xem chi tiết khoá học kèm giảng viên và điều kiện tiên quyết',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async findOne(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<CourseDetail>> {
		const data = await this.courseService.findOne(id, actor);
		return buildSuccess(data);
	}

	@Get(':id/progress')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Tiến độ tổng hợp theo khoá học' })
	@ApiOkResponse({ type: ApiResponseDto })
	async getProgress(
		@Param('id', UUID_V4_PIPE) courseId: string,
		@CurrentUser() actor: AuthUser,
		@Query() query: CourseProgressQueryDto,
	): Promise<ApiResponseDto<CourseProgressSummary>> {
		return buildSuccess(
			await this.enrollmentService.getCourseProgress(
				courseId,
				actor,
				query.userId,
			),
		);
	}

	@Patch(':id')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Cập nhật khoá học (giảng viên phụ trách hoặc admin)',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async update(
		@Param('id', UUID_V4_PIPE) id: string,
		@Body() dto: UpdateCourseDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<CourseDetail>> {
		const data = await this.courseService.update(id, dto, actor);
		return buildSuccess(data, COURSE_MESSAGE.updated);
	}

	@Delete(':id')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xoá khoá học chưa có học viên ghi danh' })
	@ApiOkResponse({ type: ApiResponseDto })
	async remove(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ success: boolean }>> {
		await this.courseService.remove(id, actor);
		return buildSuccess({ success: true }, COURSE_MESSAGE.deleted);
	}

	@Patch(':id/publish')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Công bố khoá học (cần ít nhất một bài học)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async publish(
		@Param('id', UUID_V4_PIPE) id: string,
		@Body() dto: PublishCourseDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<CourseStatusPatch>> {
		const data = await this.courseService.publish(id, dto, actor);
		return buildSuccess(data, COURSE_MESSAGE.published);
	}

	@Patch(':id/unpublish')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Ẩn khoá học khỏi catalog (giữ nguyên ghi danh)',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async unpublish(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<CourseStatusPatch>> {
		const data = await this.courseService.unpublish(id, actor);
		return buildSuccess(data, COURSE_MESSAGE.unpublished);
	}

	@Get(':id/instructors')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Danh sách giảng viên được phân công của khoá học' })
	@ApiOkResponse({ type: ApiResponseDto })
	async findInstructors(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ items: CourseInstructorItem[] }>> {
		const items = await this.courseService.findInstructors(id, actor);
		return buildSuccess({ items });
	}

	@Post(':id/instructors')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Phân công giảng viên vào khoá học (có thể theo lớp)',
	})
	@ApiCreatedResponse({ type: ApiResponseDto })
	async assignInstructor(
		@Param('id', UUID_V4_PIPE) id: string,
		@Body() dto: AssignInstructorDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<CourseInstructorItem>> {
		const data = await this.courseService.assignInstructor(id, dto, actor);
		return buildSuccess(data, COURSE_MESSAGE.instructorAssigned);
	}

	@Delete(':id/instructors/:userId')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Gỡ phân công giảng viên khỏi khoá học' })
	@ApiOkResponse({ type: ApiResponseDto })
	async removeInstructor(
		@Param('id', UUID_V4_PIPE) id: string,
		@Param('userId', UUID_V4_PIPE) userId: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ success: boolean }>> {
		await this.courseService.removeInstructor(id, userId, actor);
		return buildSuccess({ success: true }, COURSE_MESSAGE.instructorRemoved);
	}

	@Get(':id/cohorts')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Danh sách lớp của khoá học kèm sĩ số' })
	@ApiOkResponse({ type: ApiResponseDto })
	async findCohorts(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ items: CohortItem[] }>> {
		const items = await this.courseService.findCohorts(id, actor);
		return buildSuccess({ items });
	}

	@Post(':id/cohorts')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Tạo lớp cho khoá học (giảng viên phụ trách hoặc admin)',
	})
	@ApiCreatedResponse({ type: ApiResponseDto })
	async createCohort(
		@Param('id', UUID_V4_PIPE) id: string,
		@Body() dto: CreateCohortDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<CohortItem>> {
		const data = await this.courseService.createCohort(id, dto, actor);
		return buildSuccess(data, COURSE_MESSAGE.cohortCreated);
	}

	@Put(':id/prerequisites')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Thay toàn bộ danh sách khoá học tiên quyết của khoá học',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async replacePrerequisites(
		@Param('id', UUID_V4_PIPE) id: string,
		@Body() dto: ReplacePrerequisitesDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ items: PrerequisiteCourseRef[] }>> {
		const items = await this.courseService.replacePrerequisites(
			id,
			dto.courseIds,
			actor,
		);
		return buildSuccess({ items }, COURSE_MESSAGE.prerequisiteUpdated);
	}
}
