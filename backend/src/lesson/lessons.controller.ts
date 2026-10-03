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
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { FindLessonsQueryDto } from './dto/find-lessons-query.dto';
import { ReorderDto } from './dto/reorder.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import { LESSON_MESSAGE } from './constants/lesson-message.constant';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { LessonPublishState } from './lesson.service';
import type { LessonDetail, PaginatedLessons } from './types/lesson.type';

/**
 * Endpoint bài học (E3-T2) — gồm cả nhóm gắn vào chương và nhóm thao tác trên chính bài học.
 *
 * **Thứ tự khai báo route:** `PATCH lessons/:id/publish` và `.../hide` là đường dẫn con của `:id`, nên
 * Nest khớp theo **đoạn đường dẫn đầy đủ** chứ không theo thứ tự khai báo — `PATCH lessons/:id` không
 * "nuốt" hai route kia. (Khác `UserController`, nơi `me` và `:id` cùng cấp và thứ tự mới quan trọng.)
 */
@ApiTags('Lessons')
@Controller()
export class LessonsController {
	constructor(private readonly lessonService: LessonService) {}

	/** `GET /api/courses/:courseId/lessons` — mọi vai trò đã đăng nhập; học viên chỉ thấy bài đã công bố. */
	@Get('courses/:courseId/lessons')
	@ApiBearerAuth()
	@ApiOperation({
		summary:
			'Danh sách bài học của khoá học (lọc theo chương/trạng thái, sắp theo lộ trình)',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async findAllByCourse(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@Query() query: FindLessonsQueryDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<PaginatedLessons>> {
		const data = await this.lessonService.findLessons(courseId, query, actor);
		return buildSuccess(data);
	}

	/** `POST /api/sections/:sectionId/lessons` — tạo bài học trong một chương. */
	@Post('sections/:sectionId/lessons')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Tạo bài học trong chương' })
	@ApiCreatedResponse({ type: ApiResponseDto })
	async create(
		@Param('sectionId', UUID_V4_PIPE) sectionId: string,
		@Body() dto: CreateLessonDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<LessonDetail>> {
		const data = await this.lessonService.createLesson(sectionId, dto, actor);
		return buildSuccess(data, LESSON_MESSAGE.lessonCreated);
	}

	/**
	 * `PATCH /api/sections/:sectionId/lessons/reorder` — sắp xếp lại các bài **trong một chương**.
	 *
	 * Thân yêu cầu phải bao gồm **đúng và đủ** bài chưa xoá của chương đó; service từ chối `400` nếu
	 * thiếu, thừa hoặc trùng id/thứ tự.
	 */
	@Patch('sections/:sectionId/lessons/reorder')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Sắp xếp lại thứ tự bài học trong chương' })
	@ApiOkResponse({ type: ApiResponseDto })
	async reorder(
		@Param('sectionId', UUID_V4_PIPE) sectionId: string,
		@Body() dto: ReorderDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ updated: number }>> {
		const data = await this.lessonService.reorderSectionLessons(
			sectionId,
			dto,
			actor,
		);
		return buildSuccess(data, LESSON_MESSAGE.lessonsReordered);
	}

	/**
	 * `GET /api/lessons/:id` — quy tắc hiển thị là DoD được chấm điểm, xem `LessonService`:
	 * admin luôn xem được; teacher phải phụ trách khoá; student cần khoá đã công bố + bài đã công bố +
	 * ghi danh `active`/`completed` (thiếu bất kỳ điều kiện nào là `403`).
	 */
	@Get('lessons/:id')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Chi tiết bài học (kèm học liệu) theo quy tắc hiển thị',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async findOne(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<LessonDetail>> {
		const data = await this.lessonService.findLessonById(id, actor);
		return buildSuccess(data);
	}

	@Patch('lessons/:id')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Cập nhật bài học' })
	@ApiOkResponse({ type: ApiResponseDto })
	async update(
		@Param('id', UUID_V4_PIPE) id: string,
		@Body() dto: UpdateLessonDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<LessonDetail>> {
		const data = await this.lessonService.updateLesson(id, dto, actor);
		return buildSuccess(data, LESSON_MESSAGE.lessonUpdated);
	}

	/**
	 * `DELETE /api/lessons/:id` — xoá mềm và đánh số lại lộ trình; `409` nếu bài đã có bài làm hoặc
	 * tiến độ học tập (E3-T2 DoD: không phá dữ liệu analytics).
	 */
	@Delete('lessons/:id')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Xoá bài học (xoá mềm, chặn khi đã có dữ liệu học tập)',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async remove(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ success: boolean }>> {
		const data = await this.lessonService.deleteLesson(id, actor);
		return buildSuccess(data, LESSON_MESSAGE.lessonDeleted);
	}

	@Patch('lessons/:id/publish')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Công bố bài học' })
	@ApiOkResponse({ type: ApiResponseDto })
	async publish(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<LessonPublishState>> {
		const data = await this.lessonService.publishLesson(id, actor);
		return buildSuccess(data, LESSON_MESSAGE.lessonPublished);
	}

	@Patch('lessons/:id/hide')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Ẩn bài học' })
	@ApiOkResponse({ type: ApiResponseDto })
	async hide(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<LessonPublishState>> {
		const data = await this.lessonService.hideLesson(id, actor);
		return buildSuccess(data, LESSON_MESSAGE.lessonHidden);
	}
}
