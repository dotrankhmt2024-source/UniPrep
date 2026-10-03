import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
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
import { LessonService } from './lesson.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { FindSectionsQueryDto } from './dto/find-sections-query.dto';
import { ReorderDto } from './dto/reorder.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import { LESSON_MESSAGE } from './constants/lesson-message.constant';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type {
	PaginatedSections,
	SectionDetail,
	SectionListItem,
} from './types/lesson.type';

/**
 * Endpoint chương học (E3-T2).
 *
 * Chương nằm dưới khoá học về mặt URL (`/courses/:courseId/sections`) nhưng lại là tài nguyên riêng
 * khi thao tác tiếp (`/sections/:id`) — đúng như `api-specification.md` §CourseModule. Cả hai nhóm
 * nằm trong **một** controller vì chúng dùng chung `LessonService` và chung quy tắc quyền; tách ra sẽ
 * chỉ tạo thêm một lớp không mang thông tin.
 *
 * Không route nào có `@Public()`: tất cả bị `JwtAuthGuard` toàn cục bảo vệ, còn vai trò do `RolesGuard`
 * quyết định. Quyền theo **dữ liệu** (chủ sở hữu/đồng giảng viên) do `CourseAccessService` quyết định
 * trong service — guard không thể biết điều đó từ metadata của route.
 */
@ApiTags('Sections')
@Controller()
export class SectionsController {
	constructor(private readonly lessonService: LessonService) {}

	/**
	 * `GET /api/courses/:courseId/sections` — mọi vai trò đã đăng nhập.
	 *
	 * `courseId` phải là UUID v4: nếu để chuỗi tự do, một id sai định dạng vẫn đi tới Postgres và trả
	 * lỗi `22P02` (500) thay vì `400` dễ hiểu.
	 */
	@Get('courses/:courseId/sections')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Danh sách chương của khoá học (phân trang, tìm theo tiêu đề)',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async findAllByCourse(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@Query() query: FindSectionsQueryDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<PaginatedSections>> {
		const data = await this.lessonService.findSections(courseId, query, actor);
		return buildSuccess(data);
	}

	@Post('courses/:courseId/sections')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Tạo chương cho khoá học' })
	@ApiCreatedResponse({ type: ApiResponseDto })
	async create(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@Body() dto: CreateSectionDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<SectionListItem>> {
		const data = await this.lessonService.createSection(courseId, dto, actor);
		return buildSuccess(data, LESSON_MESSAGE.sectionCreated);
	}

	/**
	 * `PATCH /api/courses/:courseId/sections/reorder` — phải khai **trước** route `:id` cùng cấp?
	 * Không cần: đường dẫn khác hẳn (`courses/:courseId/sections/reorder` so với `sections/:id`), nên
	 * không có nguy cơ `reorder` bị khớp thành UUID. Ghi chú lại vì `UserController` có bẫy tương tự
	 * với `me` và `:id`.
	 */
	@Patch('courses/:courseId/sections/reorder')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Sắp xếp lại thứ tự chương của khoá học' })
	@ApiOkResponse({ type: ApiResponseDto })
	async reorder(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@Body() dto: ReorderDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ updated: number }>> {
		const data = await this.lessonService.reorderSections(courseId, dto, actor);
		return buildSuccess(data, LESSON_MESSAGE.sectionsReordered);
	}

	@Get('sections/:id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Chi tiết chương kèm danh sách bài học' })
	@ApiOkResponse({ type: ApiResponseDto })
	async findOne(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<SectionDetail>> {
		const data = await this.lessonService.findSectionById(id, actor);
		return buildSuccess(data);
	}

	@Patch('sections/:id')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Cập nhật chương' })
	@ApiOkResponse({ type: ApiResponseDto })
	async update(
		@Param('id', UUID_V4_PIPE) id: string,
		@Body() dto: UpdateSectionDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<SectionListItem>> {
		const data = await this.lessonService.updateSection(id, dto, actor);
		return buildSuccess(data, LESSON_MESSAGE.sectionUpdated);
	}

	/**
	 * `DELETE /api/sections/:id` — `409` khi chương còn bài làm/tiến độ của học viên (E3-T2 DoD: bảo
	 * vệ dữ liệu phân tích). Message `'Đã xoá chương'` do controller gắn để service không phải biết
	 * câu chữ hiển thị.
	 */
	@Delete('sections/:id')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xoá chương (chặn khi đã có dữ liệu học tập)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async remove(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ success: boolean }>> {
		const data = await this.lessonService.deleteSection(id, actor);
		return buildSuccess(data, LESSON_MESSAGE.sectionDeleted);
	}
}
