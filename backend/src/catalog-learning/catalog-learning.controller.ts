import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponseDto, buildSuccess } from '../common/dto/api-response.dto';
import type { PageMeta } from '../common/dto/page-meta.dto';
import { SearchCatalogCoursesQueryDto } from '../catalog/dto/catalog-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import { CreateCustomQuizDto } from './dto/create-custom-quiz.dto';
import { CustomQuizService, type QuizScope } from './custom-quiz.service';
import {
	CatalogCourseService,
	type LearnerCatalogCourse,
} from './catalog-course.service';

/**
 * Danh sách khoá học cho người học = toàn bộ môn trong Catalog, kèm trạng thái đã mở/đã ghi danh.
 * "Mở" một môn tạo khoá học UniPrep tương ứng (nếu chưa có) rồi trả `courseId` để vào trang chi
 * tiết và ghi danh như mọi khoá học khác.
 */
@ApiTags('Catalog')
@ApiBearerAuth()
@Controller('catalog/learning')
export class CatalogLearningController {
	constructor(
		private readonly courses: CatalogCourseService,
		private readonly customQuizzes: CustomQuizService,
	) {}

	@Get('courses/:courseId/quiz-scope')
	@Roles('student')
	@ApiOperation({
		summary:
			'Các bài của khoá kèm tiến độ của tôi — để chọn phạm vi quiz theo tiến độ',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async quizScope(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<QuizScope>> {
		return buildSuccess(await this.customQuizzes.getScope(courseId, actor));
	}

	@Post('courses/:courseId/custom-quizzes')
	@Roles('student')
	@ApiOperation({
		summary: 'AI ra quiz cá nhân từ các bài đã chọn (10–40 giây), trả quizId',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async createCustomQuiz(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@Body() dto: CreateCustomQuizDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ quizId: string }>> {
		return buildSuccess(
			await this.customQuizzes.create(
				courseId,
				dto.lessonIds,
				dto.questionCount,
				actor,
			),
			'Đã tạo quiz theo tiến độ',
		);
	}

	@Get('courses')
	@ApiOperation({
		summary: 'Môn học trong Catalog kèm trạng thái ghi danh của tôi',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async list(
		@Query() query: SearchCatalogCoursesQueryDto,
		@CurrentUser() actor: AuthUser,
	): Promise<
		ApiResponseDto<{ items: LearnerCatalogCourse[]; meta: PageMeta }>
	> {
		return buildSuccess(
			await this.courses.listForLearner(
				{
					search: query.search,
					faculty: query.faculty,
					page: query.page,
					take: query.take,
				},
				actor,
			),
		);
	}

	@Post('courses/:code/open')
	@ApiOperation({
		summary:
			'Mở khoá học từ đề cương (tạo khung khoá học nếu chưa có), trả courseId',
	})
	@ApiParam({ name: 'code', example: 'CO1023' })
	@ApiOkResponse({ type: ApiResponseDto })
	async open(
		@Param('code') code: string,
	): Promise<ApiResponseDto<{ courseId: string }>> {
		return buildSuccess(await this.courses.open(code));
	}
}
