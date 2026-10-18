import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	Res,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiProduces,
	ApiQuery,
	ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import {
	buildContentDisposition,
	isInlineViewable,
} from './submission-file.rules';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import {
	CreateQuestionDto,
	CreateQuizDto,
	FeedbackDto,
	QuizListQueryDto,
	SubmitQuizDto,
	SubmissionListQueryDto,
	UpdateQuestionDto,
	UpdateQuizDto,
} from './dto/assessment.dto';
import { ExerciseService, type SubmissionUploadFile } from './exercise.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Exercise')
@Controller()
export class ExerciseController {
	constructor(private readonly exerciseService: ExerciseService) {}

	@Get('quizzes')
	findQuizzes(
		@CurrentUser() actor: AuthUser,
		@Query() query: QuizListQueryDto,
	) {
		return this.exerciseService.findQuizzes(actor, query);
	}

	@Post('quizzes')
	@Roles('teacher', 'admin')
	createQuiz(@CurrentUser() actor: AuthUser, @Body() dto: CreateQuizDto) {
		return this.exerciseService.createQuiz(actor, dto);
	}

	@Get('quizzes/:id')
	getQuiz(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.getQuiz(id, actor);
	}

	@Patch('quizzes/:id')
	@Roles('teacher', 'admin')
	updateQuiz(
		@Param('id') id: string,
		@CurrentUser() actor: AuthUser,
		@Body() dto: UpdateQuizDto,
	) {
		return this.exerciseService.updateQuiz(id, actor, dto);
	}

	@Delete('quizzes/:id')
	@Roles('teacher', 'admin')
	deleteQuiz(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.deleteQuiz(id, actor);
	}

	@Patch('quizzes/:id/publish')
	@Roles('teacher', 'admin')
	publishQuiz(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.publishQuiz(id, actor);
	}

	@Get('quizzes/:id/questions')
	@Roles('teacher', 'admin')
	findQuestions(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.findQuestions(id, actor);
	}

	@Post('quizzes/:id/questions')
	@Roles('teacher', 'admin')
	addQuestion(
		@Param('id') id: string,
		@CurrentUser() actor: AuthUser,
		@Body() dto: CreateQuestionDto,
	) {
		return this.exerciseService.addQuestion(id, actor, dto);
	}

	@Patch('questions/:id')
	@Roles('teacher', 'admin')
	updateQuestion(
		@Param('id') id: string,
		@CurrentUser() actor: AuthUser,
		@Body() dto: UpdateQuestionDto,
	) {
		return this.exerciseService.updateQuestion(id, actor, dto);
	}

	@Delete('questions/:id')
	@Roles('teacher', 'admin')
	deleteQuestion(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.deleteQuestion(id, actor);
	}

	@Post('quizzes/:id/attempts')
	@Roles('student')
	startAttempt(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.startAttempt(id, actor);
	}

	@Get('quizzes/:id/attempts')
	findQuizAttempts(
		@Param('id') id: string,
		@CurrentUser() actor: AuthUser,
		@Query() query: SubmissionListQueryDto,
	) {
		return this.exerciseService.findQuizAttempts(id, actor, query);
	}

	@Get('attempts/:id')
	getAttempt(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.getAttempt(id, actor);
	}

	@Post('submissions')
	@Roles('student')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Nộp bài (trắc nghiệm và/hoặc tệp)',
		description:
			'Chế độ `quiz`: bắt buộc có `answers`, chấm tự động ngay. Chế độ `file`/`mixed`: bắt buộc đã tải lên ít nhất một tệp qua `POST /api/submissions/:id/files`; bài chuyển sang "chờ chấm" và giảng viên chốt điểm qua `PATCH /api/submissions/:id/feedback`.',
	})
	@ApiCreatedResponse({ type: ApiResponseDto })
	submit(@CurrentUser() actor: AuthUser, @Body() dto: SubmitQuizDto) {
		return this.exerciseService.submit(actor, dto);
	}

	/**
	 * Tải tệp cho một lượt làm đang mở (yêu cầu 4.4 — "bài tập nộp tệp").
	 *
	 * `FileInterceptor('file')` **không** truyền `storage` ⇒ multer giữ tệp trong bộ nhớ, để MIME và
	 * dung lượng được kiểm **trước** khi chạm đĩa (cùng lý do đã ghi ở `MaterialsController`).
	 * Đánh đổi: trần `MAX_UPLOAD_SIZE_MB` là hàng rào chống tự DoS — không được bỏ.
	 */
	@Post('submissions/:id/files')
	@Roles('student')
	@UseInterceptors(FileInterceptor('file'))
	@ApiBearerAuth()
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			required: ['file'],
			properties: { file: { type: 'string', format: 'binary' } },
		},
	})
	@ApiOperation({ summary: 'Đính kèm tệp vào lượt làm đang mở' })
	@ApiCreatedResponse({ type: ApiResponseDto })
	addSubmissionFile(
		@Param('id', UUID_V4_PIPE) id: string,
		@UploadedFile() file: SubmissionUploadFile | undefined,
		@CurrentUser() actor: AuthUser,
	) {
		return this.exerciseService.addSubmissionFile(id, file, actor);
	}

	@Get('submissions/:id/files')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Danh sách tệp của một bài nộp' })
	@ApiOkResponse({ type: ApiResponseDto })
	findSubmissionFiles(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	) {
		return this.exerciseService.findSubmissionFiles(id, actor);
	}

	@Delete('submission-files/:id')
	@Roles('student', 'teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xoá tệp bài nộp (chỉ khi lượt còn đang mở)' })
	@ApiOkResponse({ type: ApiResponseDto })
	deleteSubmissionFile(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	) {
		return this.exerciseService.deleteSubmissionFile(id, actor);
	}

	/**
	 * Tải tệp bài nộp — **có xác thực**, khác học liệu (`/uploads/**` là tĩnh, không qua guard).
	 *
	 * Dùng `@Res()` nên response **không** đi qua envelope `{error, data, message}` của
	 * `TransformResponseInterceptor`: đây là luồng nhị phân, không phải payload JSON.
	 */
	@Get('submission-files/:id/download')
	@ApiBearerAuth()
	@ApiProduces('application/octet-stream')
	@ApiOperation({
		summary: 'Tải tệp bài nộp (kiểm tra quyền trước khi trả tệp)',
	})
	async downloadSubmissionFile(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
		@Res() response: Response,
	): Promise<void> {
		const { stream, file } = await this.exerciseService.openSubmissionFile(
			id,
			actor,
		);
		response.setHeader('Content-Type', file.mimeType);
		response.setHeader('Content-Length', file.fileSizeBytes);
		response.setHeader(
			'Content-Disposition',
			buildContentDisposition(file.originalName),
		);
		// `X-Content-Type-Options: nosniff` chặn trình duyệt tự "đoán" lại định dạng: nếu không, một
		// tệp `.txt` chứa HTML có thể được render như trang web cùng origin với API.
		response.setHeader('X-Content-Type-Options', 'nosniff');
		stream.pipe(response);
	}
	/**
	 * `GET /api/submission-files/:id/view?token=…` — mở tệp để **trình duyệt tự render** (PDF/ảnh).
	 *
	 * `@Public()` là **bắt buộc**: khi mở bằng `<a target="_blank">`, trình duyệt không gửi header
	 * `Authorization`, nên bằng chứng truy cập phải nằm trong query — token HMAC ngắn hạn, scope theo
	 * đúng `fileId`, do `toSubmissionFile()` cấp sau khi người gọi đã qua `assertCanViewSubmission`.
	 * Route `@Public()` **không** có nghĩa là không kiểm quyền: việc kiểm nằm trong service.
	 *
	 * `Content-Disposition` là `inline` cho MIME render được và `attachment` cho phần còn lại
	 * (`isInlineViewable`) — nhờ vậy `.zip`/`.docx` vẫn tải về thay vì mở ra trang trắng.
	 */
	@Get('submission-files/:id/view')
	@Public()
	@ApiOperation({
		summary: 'Xem tệp bài nộp inline (bằng chứng là token trong URL)',
	})
	// Route không dùng Bearer mà dùng `?token=`; khai báo để Swagger UI hiện ô nhập token, nếu không
	// người đọc tài liệu sẽ thấy một endpoint "công khai không tham số" và luôn nhận 401.
	@ApiQuery({
		name: 'token',
		required: true,
		description:
			'Token HMAC ngắn hạn lấy từ trường `viewUrl` của response danh sách tệp bài nộp.',
	})
	async viewSubmissionFile(
		@Param('id', UUID_V4_PIPE) id: string,
		@Query('token') token: string | undefined,
		@Res() response: Response,
	): Promise<void> {
		const { stream, file } =
			await this.exerciseService.openSubmissionFileByToken(id, token ?? '');
		response.setHeader('Content-Type', file.mimeType);
		response.setHeader('Content-Length', file.fileSizeBytes);
		response.setHeader(
			'Content-Disposition',
			buildContentDisposition(
				file.originalName,
				isInlineViewable(file.mimeType) ? 'inline' : 'attachment',
			),
		);
		// `nosniff` phải giữ cả ở chế độ `inline`: không có nó, một tệp `.txt` chứa HTML có thể được
		// render như trang web cùng origin với API. `no-store` vì đây là tệp cá nhân, và
		// `no-referrer` để token trong URL không bị gửi tiếp khi người dùng điều hướng khỏi tab tệp.
		response.setHeader('X-Content-Type-Options', 'nosniff');
		response.setHeader('Cache-Control', 'private, no-store');
		response.setHeader('Referrer-Policy', 'no-referrer');
		stream.pipe(response);
	}

	@Get('submissions')
	findSubmissions(
		@CurrentUser() actor: AuthUser,
		@Query() query: SubmissionListQueryDto,
	) {
		return this.exerciseService.findSubmissions(actor, query);
	}

	@Get('submissions/:id')
	getSubmission(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.getSubmission(id, actor);
	}

	@Get('submissions/:id/review')
	reviewSubmission(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.reviewSubmission(id, actor);
	}

	@Patch('submissions/:id/feedback')
	@Roles('teacher', 'admin')
	updateFeedback(
		@Param('id') id: string,
		@CurrentUser() actor: AuthUser,
		@Body() dto: FeedbackDto,
	) {
		return this.exerciseService.updateFeedback(id, actor, dto);
	}
}
