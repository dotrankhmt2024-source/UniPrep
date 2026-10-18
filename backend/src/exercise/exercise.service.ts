import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	PayloadTooLargeException,
	UnsupportedMediaTypeException,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { SubmissionMode } from '../common/types';
import { buildPageMeta, toSkip } from '../common/utils/pagination.util';
import { CourseAccessService } from '../course/course-access.service';
import { Course } from '../course/entities/course.entity';
import { Enrollment } from '../course/entities/enrollment.entity';
import {
	ALLOWED_SUBMISSION_MIME_TYPES,
	MISSING_FILE_MESSAGE,
	StorageService,
	SUBMISSION_MIME_LABEL,
	SUBMISSION_MIME_MAP,
} from '../storage/storage.service';
import { decodeUploadFileName } from '../storage/upload-file-name';
import { Quiz } from './entities/quiz.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { QuizOption } from './entities/quiz-option.entity';
import { Submission } from './entities/submission.entity';
import { SubmissionAnswer } from './entities/submission-answer.entity';
import { SubmissionFile } from './entities/submission-file.entity';
import type {
	CreateQuestionDto,
	CreateQuizDto,
	FeedbackDto,
	QuizListQueryDto,
	SubmitQuizDto,
	SubmissionListQueryDto,
	UpdateQuestionDto,
	UpdateQuizDto,
} from './dto/assessment.dto';
import { gradeObjectiveQuestions } from './assessment-grading';
import {
	MAX_SUBMISSION_FILES,
	SUBMISSION_FILE_FOLDER,
	allowsLateSubmission,
	canAttachFile,
	canUploadMoreFiles,
	isAutoGradedOnSubmit,
	needsSubmissionFile,
	requiresQuestions,
	submissionStatusAfterSubmit,
	totalMaxScore,
	isInlineViewable,
} from './submission-file.rules';
import {
	signSubmissionFileToken,
	verifySubmissionFileToken,
} from './submission-file-token';
type QuestionWithOptions = QuizQuestion & { options: QuizOption[] };

/**
 * Hình dạng tối thiểu của tệp multer mà tầng service cần.
 *
 * Khai báo cục bộ (không import `UploadedFileLike` từ `LessonModule`) để `ExerciseModule` không
 * phụ thuộc ngược vào module bài học — hai module chỉ chia sẻ hạ tầng qua `StorageService`.
 */
export interface SubmissionUploadFile {
	originalname: string;
	mimetype: string;
	size: number;
	buffer: Buffer;
}

@Injectable()
export class ExerciseService {
	private readonly logger = new Logger(ExerciseService.name);

	constructor(
		@InjectRepository(Course)
		private readonly courses: Repository<Course>,
		@InjectRepository(Enrollment)
		private readonly enrollments: Repository<Enrollment>,
		@InjectRepository(Quiz)
		private readonly quizzes: Repository<Quiz>,
		@InjectRepository(QuizQuestion)
		private readonly questions: Repository<QuizQuestion>,
		@InjectRepository(QuizOption)
		private readonly options: Repository<QuizOption>,
		@InjectRepository(Submission)
		private readonly submissions: Repository<Submission>,
		@InjectRepository(SubmissionAnswer)
		private readonly answers: Repository<SubmissionAnswer>,
		@InjectRepository(SubmissionFile)
		private readonly files: Repository<SubmissionFile>,
		private readonly courseAccess: CourseAccessService,
		private readonly configService: ConfigService, // Dòng mới thêm
		private readonly storage: StorageService,
		private readonly dataSource: DataSource,
	) {}

	async findQuizzes(actor: AuthUser, query: QuizListQueryDto) {
		const builder = this.quizzes
			.createQueryBuilder('quiz')
			.innerJoin('quiz.course', 'course')
			.where('quiz.deletedAt IS NULL')
			.andWhere('course.deletedAt IS NULL');

		if (actor.role === 'student') {
			builder
				.andWhere('quiz.isPublished = true')
				.andWhere("course.status = 'published'")
				.andWhere("course.visibility <> 'private'")
				.andWhere(
					`EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = quiz.course_id
						AND e.user_id = :actorId AND e.status IN ('active', 'completed'))`,
					{ actorId: actor.id },
				);
		} else if (actor.role === 'teacher') {
			builder.andWhere(
				`(course.owner_id = :actorId OR EXISTS (
					SELECT 1 FROM course_instructors ci
					WHERE ci.course_id = course.id AND ci.user_id = :actorId
				))`,
				{ actorId: actor.id },
			);
		}

		if (query.courseId)
			builder.andWhere('quiz.courseId = :courseId', {
				courseId: query.courseId,
			});
		if (query.lessonId)
			builder.andWhere('quiz.lessonId = :lessonId', {
				lessonId: query.lessonId,
			});
		if (query.search) {
			builder.andWhere('LOWER(quiz.title) LIKE :search', {
				search: `%${query.search.toLowerCase()}%`,
			});
		}
		if (query.status === 'draft') builder.andWhere('quiz.isPublished = false');
		if (query.status === 'published') {
			builder
				.andWhere('quiz.isPublished = true')
				.andWhere('(quiz.dueAt IS NULL OR quiz.dueAt >= :now)', {
					now: new Date(),
				});
		}
		if (query.status === 'closed') {
			builder
				.andWhere('quiz.isPublished = true')
				.andWhere('quiz.dueAt < :now', {
					now: new Date(),
				});
		}

		const sortColumns = {
			createdAt: 'quiz.createdAt',
			title: 'quiz.title',
			openAt: 'quiz.availableFrom',
		} as const;
		const [items, total] = await builder
			.orderBy(
				sortColumns[query.sortBy],
				query.order.toUpperCase() as 'ASC' | 'DESC',
			)
			.addOrderBy('quiz.id', 'ASC')
			.skip(toSkip(query.page, query.take))
			.take(query.take)
			.getManyAndCount();

		return {
			items: await Promise.all(
				items.map((quiz) => this.toQuizSummary(quiz, actor)),
			),
			meta: buildPageMeta(total, query.page, query.take),
		};
	}

	async createQuiz(actor: AuthUser, dto: CreateQuizDto) {
		const course = await this.courseAccess.assertCanManage(dto.courseId, actor);
		this.assertDateRange(dto.openAt, dto.closeAt);
		// Chế độ `quiz` không dùng `max_score` (điểm tối đa suy từ tổng điểm câu hỏi) nên ép `NULL`
		// để dữ liệu không mang một con số vô nghĩa gây hiểu nhầm khi đọc bảng.
		const mode: SubmissionMode = dto.submissionMode ?? 'quiz';
		const quiz = await this.quizzes.save(
			this.quizzes.create({
				courseId: course.id,
				lessonId: dto.lessonId ?? null,
				title: dto.title,
				description: dto.description ?? null,
				timeLimitSeconds:
					dto.timeLimitMinutes == null ? null : dto.timeLimitMinutes * 60,
				maxAttempts: dto.maxAttempts ?? 1,
				passScore: dto.passScore ?? null,
				shuffleQuestions: dto.shuffleQuestions ?? false,
				submissionMode: mode,
				maxScore: requiresQuestions(mode) ? null : (dto.maxScore ?? null),
				availableFrom: dto.openAt ? new Date(dto.openAt) : null,
				dueAt: dto.closeAt ? new Date(dto.closeAt) : null,
				createdBy: actor.id,
			}),
		);
		return this.toQuizSummary(quiz, actor);
	}

	async getQuiz(id: string, actor: AuthUser) {
		const quiz = await this.findQuizOrFail(id);
		await this.assertCanViewQuiz(quiz, actor);
		const questionRows = await this.questionQuery(
			quiz.id,
			actor.role !== 'student',
		);
		return {
			...(await this.toQuizSummary(quiz, actor)),
			questions: questionRows.map((question) =>
				this.toQuestion(question, actor.role !== 'student'),
			),
		};
	}

	async updateQuiz(id: string, actor: AuthUser, dto: UpdateQuizDto) {
		const quiz = await this.assertCanManageQuiz(id, actor);
		if ((await this.submissions.count({ where: { quizId: id } })) > 0) {
			throw new ConflictException(
				'Không thể sửa cấu hình bài kiểm tra đã có lượt làm.',
			);
		}
		const openAt =
			dto.openAt === undefined
				? quiz.availableFrom
				: dto.openAt
					? new Date(dto.openAt)
					: null;
		const closeAt =
			dto.closeAt === undefined
				? quiz.dueAt
				: dto.closeAt
					? new Date(dto.closeAt)
					: null;
		this.assertDateRange(openAt?.toISOString(), closeAt?.toISOString());
		if (dto.title !== undefined) quiz.title = dto.title;
		if (dto.description !== undefined) quiz.description = dto.description;
		if (dto.timeLimitMinutes !== undefined) {
			quiz.timeLimitSeconds =
				dto.timeLimitMinutes == null ? null : dto.timeLimitMinutes * 60;
		}
		if (dto.maxAttempts !== undefined) quiz.maxAttempts = dto.maxAttempts;
		if (dto.passScore !== undefined) quiz.passScore = dto.passScore;
		if (dto.shuffleQuestions !== undefined)
			quiz.shuffleQuestions = dto.shuffleQuestions;
		if (dto.submissionMode !== undefined)
			quiz.submissionMode = dto.submissionMode;
		if (dto.maxScore !== undefined) quiz.maxScore = dto.maxScore;
		// Đổi sang chế độ `quiz` thì `max_score` không còn nghĩa — xoá để không lưu số dư thừa.
		if (requiresQuestions(quiz.submissionMode)) quiz.maxScore = null;
		quiz.availableFrom = openAt;
		quiz.dueAt = closeAt;
		return this.toQuizSummary(await this.quizzes.save(quiz), actor);
	}

	async deleteQuiz(id: string, actor: AuthUser) {
		const quiz = await this.assertCanManageQuiz(id, actor);
		if ((await this.submissions.count({ where: { quizId: id } })) > 0) {
			throw new ConflictException('Không thể xoá bài kiểm tra đã có bài nộp.');
		}
		quiz.deletedAt = new Date();
		await this.quizzes.save(quiz);
		return { success: true };
	}

	async publishQuiz(id: string, actor: AuthUser) {
		const quiz = await this.assertCanManageQuiz(id, actor);
		// Chỉ chế độ `quiz` mới bắt buộc có câu hỏi: bài tập nộp tệp không có câu hỏi nào vẫn hợp lệ,
		// và trước đây điều kiện này chặn cứng nên không thể công bố bài nộp tệp.
		if (
			requiresQuestions(quiz.submissionMode) &&
			(await this.questions.count({ where: { quizId: id } })) === 0
		) {
			throw new BadRequestException(
				'Bài kiểm tra trắc nghiệm phải có ít nhất một câu hỏi.',
			);
		}
		quiz.isPublished = true;
		const saved = await this.quizzes.save(quiz);
		return {
			id: saved.id,
			status: this.statusOf(saved),
			updatedAt: saved.updatedAt,
		};
	}

	async findQuestions(id: string, actor: AuthUser) {
		await this.assertCanManageQuiz(id, actor);
		const items = await this.questionQuery(id, true);
		return {
			items: items.map((question) => this.toQuestion(question, true)),
			meta: buildPageMeta(items.length, 1, 100),
		};
	}

	async addQuestion(quizId: string, actor: AuthUser, dto: CreateQuestionDto) {
		await this.assertCanManageQuiz(quizId, actor);
		await this.assertNoSubmissions(quizId);
		this.assertCorrectOptions(dto.type, dto.options);
		const questionId = await this.dataSource.transaction(async (manager) => {
			const questionRepo = manager.getRepository(QuizQuestion);
			const optionRepo = manager.getRepository(QuizOption);
			const orderIndex = (await questionRepo.count({ where: { quizId } })) + 1;
			const question = await questionRepo.save(
				questionRepo.create({
					quizId,
					content: dto.content,
					questionType: dto.type,
					points: dto.points ?? 1,
					explanation: dto.explanation ?? null,
					orderIndex,
				}),
			);
			await optionRepo.save(
				dto.options.map((option, index) =>
					optionRepo.create({
						questionId: question.id,
						content: option.content,
						isCorrect: option.isCorrect,
						orderIndex: index + 1,
					}),
				),
			);
			return question.id;
		});
		return this.toQuestion(await this.loadQuestion(questionId, true), true);
	}

	async updateQuestion(id: string, actor: AuthUser, dto: UpdateQuestionDto) {
		const question = await this.findQuestionOrFail(id);
		await this.assertCanManageQuiz(question.quizId, actor);
		await this.assertNoSubmissions(question.quizId);
		Object.assign(question, dto);
		return this.toQuestion(
			await this.questions
				.save(question)
				.then((saved) => this.loadQuestion(saved.id, true)),
			true,
		);
	}

	async deleteQuestion(id: string, actor: AuthUser) {
		const question = await this.findQuestionOrFail(id);
		await this.assertCanManageQuiz(question.quizId, actor);
		await this.assertNoSubmissions(question.quizId);
		await this.questions.delete(id);
		return { success: true };
	}

	async startAttempt(quizId: string, actor: AuthUser) {
		const quiz = await this.findQuizOrFail(quizId);
		await this.assertStudentCanAttempt(quiz, actor);
		const existing = await this.submissions.findOne({
			where: { quizId, userId: actor.id, status: 'in_progress' },
		});
		if (existing) {
			const expiry = this.expiresAt(existing, quiz);
			if (!expiry || new Date() < expiry)
				return this.toAttempt(existing, quiz, actor);
			existing.status = 'expired';
			await this.submissions.save(existing);
		}

		const attemptCount = await this.submissions.count({
			where: { quizId, userId: actor.id },
		});
		if (quiz.maxAttempts !== null && attemptCount >= quiz.maxAttempts) {
			throw new ConflictException('Bạn đã hết số lần làm bài.');
		}
		const enrollment = await this.enrollments.findOne({
			where: {
				courseId: quiz.courseId,
				userId: actor.id,
				status: Not('dropped'),
			},
		});
		if (!enrollment)
			throw new ForbiddenException('Bạn chưa ghi danh khoá học này.');
		const questions = await this.questionQuery(quizId, false);
		// Bài tập nộp tệp hợp lệ dù không có câu hỏi nào; chỉ trắc nghiệm mới bắt buộc có câu hỏi.
		if (requiresQuestions(quiz.submissionMode) && !questions.length)
			throw new BadRequestException('Bài kiểm tra chưa có câu hỏi.');
		const questionPoints = questions.reduce(
			(sum, question) => sum + Number(question.points),
			0,
		);
		const submission = await this.submissions.save(
			this.submissions.create({
				quizId,
				userId: actor.id,
				enrollmentId: enrollment.id,
				courseId: quiz.courseId,
				attemptNo: attemptCount + 1,
				status: 'in_progress',
				maxScore: totalMaxScore(
					quiz.submissionMode,
					quiz.maxScore,
					questionPoints,
				),
			}),
		);
		return this.toAttempt(submission, quiz, actor);
	}

	async getAttempt(id: string, actor: AuthUser) {
		const submission = await this.findSubmissionOrFail(id);
		const quiz = await this.findQuizOrFail(submission.quizId);
		await this.assertCanViewSubmission(submission, quiz, actor);
		if (submission.status === 'in_progress') {
			const expiresAt = this.expiresAt(submission, quiz);
			if (expiresAt && new Date() >= expiresAt) {
				submission.status = 'expired';
				await this.submissions.save(submission);
			}
		}
		return this.toAttempt(submission, quiz, actor, true);
	}

	async findQuizAttempts(
		quizId: string,
		actor: AuthUser,
		query: SubmissionListQueryDto,
	) {
		const quiz = await this.findQuizOrFail(quizId);
		if (actor.role === 'student') await this.assertCanViewQuiz(quiz, actor);
		else await this.courseAccess.assertCanManage(quiz.courseId, actor);
		return this.findSubmissions(actor, { ...query, quizId });
	}

	async submit(actor: AuthUser, dto: SubmitQuizDto) {
		const submission = await this.findSubmissionOrFail(dto.attemptId);
		if (submission.userId !== actor.id) {
			throw new ForbiddenException('Đây không phải lượt làm bài của bạn.');
		}
		if (submission.status !== 'in_progress') {
			throw new ConflictException('Lượt làm bài này đã được nộp.');
		}
		const quiz = await this.findQuizOrFail(submission.quizId);
		const mode = quiz.submissionMode;
		const expiresAt = this.expiresAt(submission, quiz);
		if (expiresAt && new Date() >= expiresAt) {
			submission.status = 'expired';
			await this.submissions.save(submission);
			throw new ConflictException('Lượt làm bài đã hết hạn.');
		}
		// Chỉ trắc nghiệm mới đóng cứng theo hạn nộp; `file`/`mixed` nộp muộn vẫn được ghi nhận
		// (`is_late = true`) — xem `submission-file.rules.ts`.
		if (!allowsLateSubmission(mode) && quiz.dueAt && new Date() > quiz.dueAt) {
			submission.status = 'expired';
			await this.submissions.save(submission);
			throw new ConflictException('Bài kiểm tra đã đóng.');
		}

		const answers = dto.answers ?? [];
		const questions = await this.questionQuery(quiz.id, true);
		const questionPoints = questions.reduce(
			(sum, question) => sum + Number(question.points),
			0,
		);

		let grading: ReturnType<typeof gradeObjectiveQuestions> = {
			answers: [],
			score: 0,
			correctCount: 0,
		};
		if (requiresQuestions(mode)) {
			if (!answers.length) {
				throw new BadRequestException('Vui lòng trả lời ít nhất một câu hỏi.');
			}
			grading = gradeObjectiveQuestions(questions, answers);
		} else if (questions.length) {
			// `mixed`: phần trắc nghiệm được chấm tự động và lưu làm **điểm tạm**; giảng viên chốt
			// điểm cuối cùng qua `PATCH /api/submissions/:id/feedback`.
			grading = gradeObjectiveQuestions(questions, answers);
		}

		const autoGraded = isAutoGradedOnSubmit(mode);
		const hasGradedAnswers = autoGraded || questions.length > 0;
		const statusAfter = submissionStatusAfterSubmit(mode);
		const finalScore = hasGradedAnswers ? grading.score : null;
		const maxScore = totalMaxScore(mode, quiz.maxScore, questionPoints);
		const submittedAt = new Date();
		const elapsed = Math.max(
			0,
			Math.floor(
				(submittedAt.getTime() - submission.startedAt.getTime()) / 1000,
			),
		);
		const late = !!quiz.dueAt && submittedAt > quiz.dueAt;
		let savedFileCount = 0;

		await this.dataSource.transaction(async (manager) => {
			// Khoá hàng bài nộp: chặn đua với `addSubmissionFile`/`deleteSubmissionFile` đang chạy
			// song song, nếu không có thể nộp thành công trong khi tệp cuối vẫn đang được ghi.
			const locked = await manager.getRepository(Submission).findOne({
				where: { id: submission.id },
				lock: { mode: 'pessimistic_write' },
			});
			if (!locked || locked.status !== 'in_progress') {
				throw new ConflictException('Lượt làm bài này đã được nộp.');
			}
			savedFileCount = await manager
				.getRepository(SubmissionFile)
				.count({ where: { submissionId: submission.id } });
			if (needsSubmissionFile(mode) && savedFileCount === 0) {
				throw new BadRequestException(
					'Vui lòng đính kèm ít nhất một tệp trước khi nộp bài.',
				);
			}
			if (grading.answers.length) {
				await manager.getRepository(SubmissionAnswer).save(
					grading.answers.map((answer) =>
						manager.getRepository(SubmissionAnswer).create({
							submissionId: submission.id,
							questionId: answer.questionId,
							selectedOptionIds: answer.selectedOptionIds,
							isCorrect: answer.isCorrect,
							pointsAwarded: answer.pointsAwarded,
						}),
					),
				);
			}
			locked.score = finalScore;
			locked.maxScore = maxScore;
			locked.correctCount = hasGradedAnswers ? grading.correctCount : null;
			locked.totalQuestions = questions.length || null;
			locked.status = statusAfter;
			locked.submittedAt = submittedAt;
			// Chờ chấm tay thì `graded_at` phải để trống, nếu không dữ liệu nói dối rằng bài đã chấm.
			locked.gradedAt = autoGraded ? submittedAt : null;
			locked.durationSeconds = elapsed;
			locked.isLate = late;
			await manager.getRepository(Submission).save(locked);
		});

		return {
			id: submission.id,
			attemptId: submission.id,
			quizId: quiz.id,
			userId: actor.id,
			submissionMode: mode,
			status: statusAfter,
			score: finalScore,
			maxScore,
			correctCount: hasGradedAnswers ? grading.correctCount : null,
			totalQuestions: questions.length,
			passed:
				statusAfter === 'graded' && quiz.passScore != null
					? finalScore !== null && finalScore >= quiz.passScore
					: null,
			autoGraded,
			// Cờ tường minh cho FE: `score` hiện tại là điểm tạm hay điểm đã chốt.
			awaitingManualGrading: !autoGraded,
			submittedAt,
			gradedAt: autoGraded ? submittedAt : null,
			attemptNo: submission.attemptNo,
			durationSeconds: elapsed,
			isLate: late,
			fileCount: savedFileCount,
		};
	}

	// =========================================================================
	// Tệp bài nộp (yêu cầu 4.4 — "bài tập nộp tệp")
	// =========================================================================

	/**
	 * `POST /api/submissions/:id/files` — học viên đính kèm tệp vào lượt làm đang mở.
	 *
	 * Thứ tự kiểm tra theo đúng `LessonService.createMaterial`: quyền/trạng thái → có tệp → MIME →
	 * dung lượng → ghi đĩa → ghi DB. Kiểm MIME **trước** dung lượng để tệp `.exe` 100 MB nhận đúng
	 * thông báo "định dạng không hỗ trợ" thay vì "quá lớn"; ghi đĩa **trước** DB kèm bù trừ để không
	 * bao giờ có hàng DB trỏ tới tệp không tồn tại.
	 */
	async addSubmissionFile(
		submissionId: string,
		file: SubmissionUploadFile | undefined,
		actor: AuthUser,
	) {
		const submission = await this.findSubmissionOrFail(submissionId);
		const quiz = await this.findQuizOrFail(submission.quizId);
		if (actor.role !== 'student' || submission.userId !== actor.id) {
			throw new ForbiddenException(
				'Chỉ học viên sở hữu lượt làm mới được đính kèm tệp.',
			);
		}
		if (!canAttachFile(submission.status)) {
			throw new ConflictException(
				'Chỉ có thể đính kèm tệp khi lượt làm đang diễn ra.',
			);
		}
		if (!needsSubmissionFile(quiz.submissionMode)) {
			throw new BadRequestException(
				'Bài kiểm tra này chỉ nhận đáp án trắc nghiệm.',
			);
		}
		const expiresAt = this.expiresAt(submission, quiz);
		if (expiresAt && new Date() >= expiresAt) {
			submission.status = 'expired';
			await this.submissions.save(submission);
			throw new ConflictException('Lượt làm bài đã hết hạn.');
		}
		if (!file?.buffer) {
			throw new BadRequestException(MISSING_FILE_MESSAGE);
		}
		if (!SUBMISSION_MIME_MAP[file.mimetype]) {
			throw new UnsupportedMediaTypeException(
				`Định dạng tệp không được hỗ trợ. Chỉ nhận: ${this.describeAllowedSubmissionMimeTypes()}.`,
			);
		}
		if (file.size > this.storage.maxSizeBytes) {
			throw new PayloadTooLargeException(
				`Tệp vượt quá dung lượng cho phép (tối đa ${this.storage.maxSizeMb} MB).`,
			);
		}

		// Tên gốc dài hơn cột `original_name` sẽ làm hỏng INSERT; cắt trước khi lưu. Đuôi tệp trên
		// đĩa do MIME quyết định (`StorageService.resolveExtension`) nên việc cắt này vô hại.
		// Giải mã latin1→utf8 trước: multer/busboy trả tên tiếng Việt ở dạng mojibake.
		const originalName = decodeUploadFileName(file.originalname).slice(0, 255);
		const saved = await this.storage.saveBuffer({
			folder: `${SUBMISSION_FILE_FOLDER}/${submissionId}`,
			originalName,
			buffer: file.buffer,
			mimeType: file.mimetype,
		});

		try {
			const row = await this.dataSource.transaction(async (manager) => {
				// Khoá hàng bài nộp: "đếm số tệp rồi ghi" phải là một khối duy nhất, nếu không hai
				// request upload song song cùng lúc có thể vượt trần số tệp, và `submit` có thể chốt
				// lượt trong khi tệp cuối vẫn đang được ghi.
				const locked = await manager.getRepository(Submission).findOne({
					where: { id: submissionId },
					lock: { mode: 'pessimistic_write' },
				});
				if (!locked || !canAttachFile(locked.status)) {
					throw new ConflictException(
						'Chỉ có thể đính kèm tệp khi lượt làm đang diễn ra.',
					);
				}
				const currentCount = await manager
					.getRepository(SubmissionFile)
					.count({ where: { submissionId } });
				if (!canUploadMoreFiles(currentCount)) {
					throw new BadRequestException(
						`Mỗi lượt nộp tối đa ${MAX_SUBMISSION_FILES} tệp.`,
					);
				}
				const repo = manager.getRepository(SubmissionFile);
				return repo.save(
					repo.create({
						submissionId,
						uploadedBy: actor.id,
						originalName,
						storageKey: saved.storageKey,
						mimeType: file.mimetype,
						fileSizeBytes: file.size,
					}),
				);
			});
			return this.toSubmissionFile(row);
		} catch (error) {
			// Bù trừ: hàng DB không được tạo thì tệp vừa ghi là rác. Ghi log vì đây là lỗi hiếm và
			// người vận hành cần biết có tệp mồ côi trong `UPLOAD_DIR`.
			this.logger.error(
				`Không tạo được tệp cho bài nộp ${submissionId}, đã xoá tệp ${saved.storageKey}`,
			);
			await this.storage.remove(saved.storageKey);
			throw error;
		}
	}

	/** `GET /api/submissions/:id/files` — học viên sở hữu, giảng viên phụ trách, admin. */
	async findSubmissionFiles(submissionId: string, actor: AuthUser) {
		const submission = await this.findSubmissionOrFail(submissionId);
		const quiz = await this.findQuizOrFail(submission.quizId);
		await this.assertCanViewSubmission(submission, quiz, actor);
		const rows = await this.files.find({
			where: { submissionId },
			order: { createdAt: 'ASC' },
		});
		return {
			submissionId,
			submissionMode: quiz.submissionMode,
			// FE dùng cờ này để quyết định hiện khu vực tải tệp; giữ ở server để luật "ai được ghi"
			// chỉ có một nơi định nghĩa (`assertCanViewSubmission` + `canAttachFile`).
			allowUpload:
				actor.role === 'student' &&
				submission.userId === actor.id &&
				canAttachFile(submission.status) &&
				needsSubmissionFile(quiz.submissionMode),
			maxFiles: MAX_SUBMISSION_FILES,
			items: rows.map((row) => this.toSubmissionFile(row)),
		};
	}

	/**
	 * Mở luồng đọc của một tệp bài nộp — phần dùng chung cho **cả hai** đường vào (Bearer và token).
	 *
	 * Tệp có thể đã bị xoá tay khỏi đĩa: trả `404` còn hơn để lỗi ENOENT thành `500`.
	 */
	private async streamFileRow(row: SubmissionFile) {
		const stream = await this.storage
			.openReadStream(row.storageKey)
			.catch(() => null);
		if (!stream) {
			throw new NotFoundException('Tệp không còn trên máy chủ.');
		}
		return { stream, file: this.toSubmissionFile(row) };
	}

	/**
	 * `GET /api/submission-files/:id/download` — tải tệp **có xác thực**.
	 *
	 * Vì sao không phục vụ tĩnh qua `/uploads/**` như học liệu: thư mục tĩnh không đi qua guard nào
	 * (`main.ts` dùng `useStaticAssets`), nên ai có URL là tải được. Với bài làm cá nhân của học viên
	 * thì đó là rò rỉ dữ liệu, nên tệp bài nộp đi qua endpoint và dùng đúng
	 * `assertCanViewSubmission` như `GET /api/submissions/:id`.
	 */
	async openSubmissionFile(id: string, actor: AuthUser) {
		const row = await this.findSubmissionFileOrFail(id);
		const submission = await this.findSubmissionOrFail(row.submissionId);
		const quiz = await this.findQuizOrFail(submission.quizId);
		await this.assertCanViewSubmission(submission, quiz, actor);
		return this.streamFileRow(row);
	}

	/**
	 * `GET /api/submission-files/:id/view?token=…` — mở tệp để **trình duyệt tự render** (PDF/ảnh).
	 *
	 * Route này là `@Public()` vì `<a target="_blank">` **không gửi** header `Authorization`; bằng
	 * chứng truy cập nằm ở token HMAC trong query (`submission-file-token.ts`). Token được cấp trong
	 * `toSubmissionFile()` — tức chỉ sau khi người gọi đã qua `assertCanViewSubmission` — nên
	 * `@Public()` ở đây **không** có nghĩa là không kiểm quyền.
	 */
	async openSubmissionFileByToken(id: string, token: string) {
		// Kiểm token **trước** khi tra DB: token của tệp khác phải bị từ chối bằng `401`, không phải
		// `404` — nếu tra DB trước thì kẻ dò id sẽ phân biệt được "tệp tồn tại" với "không tồn tại".
		const secret = this.configService.get<string>('JWT_SECRET') ?? '';
		if (!verifySubmissionFileToken(secret, id, token)) {
			throw new UnauthorizedException(
				'Liên kết xem tệp không hợp lệ hoặc đã hết hạn.',
			);
		}
		return this.streamFileRow(await this.findSubmissionFileOrFail(id));
	}
	/**
	 * `DELETE /api/submission-files/:id` — chỉ khi lượt còn đang mở.
	 *
	 * Vì sao giảng viên cũng không xoá được tệp đã nộp: bài nộp là bằng chứng đánh giá; sửa nó sau
	 * khi nộp sẽ làm lệch điểm và lịch sử. Giảng viên muốn loại tệp thì dùng phản hồi/yêu cầu nộp lại.
	 */
	async deleteSubmissionFile(id: string, actor: AuthUser) {
		const row = await this.findSubmissionFileOrFail(id);
		const submission = await this.findSubmissionOrFail(row.submissionId);
		const quiz = await this.findQuizOrFail(submission.quizId);
		await this.assertCanViewSubmission(submission, quiz, actor);
		if (!canAttachFile(submission.status)) {
			throw new ConflictException('Không thể xoá tệp sau khi bài đã được nộp.');
		}
		await this.files.delete({ id });
		// Best-effort: hàng DB là nguồn chân lý, tệp mồ côi chỉ tốn đĩa (cùng quy tắc với học liệu).
		await this.storage.remove(row.storageKey);
		return { success: true };
	}

	private toSubmissionFile(row: SubmissionFile) {
		const secret = this.configService.get<string>('JWT_SECRET') ?? '';
		const token = signSubmissionFileToken(secret, row.id);
		return {
			id: row.id,
			submissionId: row.submissionId,
			originalName: row.originalName,
			mimeType: row.mimeType,
			fileSizeBytes: row.fileSizeBytes,
			uploadedBy: row.uploadedBy,
			// `storageKey` **không** được trả ra: đường dẫn nội bộ trên đĩa không phải thông tin cho
			// client, và giữ kín nó là lớp phòng thủ thứ hai ngoài kiểm tra quyền.
			downloadUrl: `/api/submission-files/${row.id}/download`,
			viewUrl: `/api/submission-files/${row.id}/view?token=${encodeURIComponent(token)}`,
			canPreview: isInlineViewable(row.mimeType),
			createdAt: row.createdAt,
		};
	}

	private async findSubmissionFileOrFail(id: string) {
		const row = await this.files.findOne({ where: { id } });
		if (!row) throw new NotFoundException('Không tìm thấy tệp bài nộp.');
		return row;
	}

	private describeAllowedSubmissionMimeTypes(): string {
		return ALLOWED_SUBMISSION_MIME_TYPES.map(
			(mime) => SUBMISSION_MIME_LABEL[mime] ?? mime,
		).join(', ');
	}

	async findSubmissions(actor: AuthUser, query: SubmissionListQueryDto) {
		const builder = this.submissions
			.createQueryBuilder('submission')
			.innerJoinAndSelect('submission.quiz', 'quiz')
			.innerJoinAndSelect('submission.user', 'student')
			.innerJoin('quiz.course', 'course')
			.where('quiz.deletedAt IS NULL');
		if (actor.role === 'student')
			builder.andWhere('submission.userId = :actorId', { actorId: actor.id });
		if (actor.role === 'teacher') {
			builder.andWhere(
				'(course.ownerId = :actorId OR EXISTS (SELECT 1 FROM course_instructors ci WHERE ci.course_id = course.id AND ci.user_id = :actorId))',
				{ actorId: actor.id },
			);
		}
		if (query.courseId)
			builder.andWhere('submission.courseId = :courseId', {
				courseId: query.courseId,
			});
		if (query.quizId)
			builder.andWhere('submission.quizId = :quizId', { quizId: query.quizId });
		if (query.userId) {
			if (actor.role === 'student' && query.userId !== actor.id)
				throw new ForbiddenException(
					'Bạn chỉ có thể xem bài nộp của chính mình.',
				);
			builder.andWhere('submission.userId = :targetUserId', {
				targetUserId: query.userId,
			});
		}
		if (query.status)
			builder.andWhere('submission.status = :status', { status: query.status });
		const [items, total] = await builder
			.orderBy('submission.submittedAt', 'DESC')
			.skip(toSkip(query.page, query.take))
			.take(query.take)
			.getManyAndCount();
		// Đếm tệp bằng **một** truy vấn gộp nhóm thay vì một truy vấn cho mỗi dòng: danh sách bài nộp
		// của giảng viên có thể tới 100 dòng (`take ≤ 100`), nhân lên thành 100 round-trip là lãng phí.
		const fileCounts = new Map<string, number>();
		if (items.length) {
			const rows = await this.files
				.createQueryBuilder('file')
				.select('file.submissionId', 'submissionId')
				.addSelect('COUNT(*)', 'count')
				.where('file.submissionId IN (:...ids)', {
					ids: items.map((item) => item.id),
				})
				.groupBy('file.submissionId')
				.getRawMany<{ submissionId: string; count: string }>();
			for (const row of rows) {
				fileCounts.set(row.submissionId, Number(row.count));
			}
		}
		return {
			items: items.map((item) => ({
				id: item.id,
				quiz: { id: item.quiz.id, title: item.quiz.title },
				student: {
					id: item.userId,
					fullName: item.user.fullName,
					studentCode: item.user.studentCode,
				},
				userId: item.userId,
				attemptNo: item.attemptNo,
				submissionMode: item.quiz.submissionMode,
				status: item.status,
				score: item.score,
				maxScore: item.maxScore,
				fileCount: fileCounts.get(item.id) ?? 0,
				isLate: item.isLate,
				submittedAt: item.submittedAt,
				hasFeedback: !!item.feedback,
				createdAt: item.createdAt,
				updatedAt: item.updatedAt,
			})),
			meta: buildPageMeta(total, query.page, query.take),
		};
	}

	async getSubmission(id: string, actor: AuthUser) {
		const submission = await this.findSubmissionOrFail(id);
		const quiz = await this.findQuizOrFail(submission.quizId);
		await this.assertCanViewSubmission(submission, quiz, actor);
		return {
			id: submission.id,
			attemptId: submission.id,
			quiz: { id: quiz.id, title: quiz.title },
			userId: submission.userId,
			attemptNo: submission.attemptNo,
			submissionMode: quiz.submissionMode,
			status: submission.status,
			// `score` có thể là điểm tạm của phần trắc nghiệm trong chế độ `mixed`; FE phân biệt bằng
			// `awaitingManualGrading`.
			awaitingManualGrading:
				submission.status === 'submitted' && !submission.gradedAt,
			score: submission.score,
			maxScore: submission.maxScore,
			correctCount: submission.correctCount,
			totalQuestions: submission.totalQuestions,
			durationSeconds: submission.durationSeconds,
			submittedAt: submission.submittedAt,
			isLate: submission.isLate,
			teacherFeedback: submission.feedback,
			feedbackAt: submission.feedbackAt,
			files: (
				await this.files.find({
					where: { submissionId: id },
					order: { createdAt: 'ASC' },
				})
			).map((row) => this.toSubmissionFile(row)),
			createdAt: submission.createdAt,
			updatedAt: submission.updatedAt,
		};
	}

	async reviewSubmission(id: string, actor: AuthUser) {
		const submission = await this.findSubmissionOrFail(id);
		const quiz = await this.findQuizOrFail(submission.quizId);
		await this.assertCanViewSubmission(submission, quiz, actor);
		if (submission.status === 'in_progress' || submission.status === 'expired')
			throw new BadRequestException('Bài nộp chưa được chấm xong.');
		const duePassed = quiz.dueAt !== null && new Date() >= quiz.dueAt;
		const questionRows = await this.questionQuery(quiz.id, true);
		// Cờ "cho xem đáp án" chỉ có nghĩa khi bài **có** câu hỏi; bài nộp tệp thuần không có đáp án
		// nào để giấu, nên chặn ở đây sẽ làm học viên không xem được kết quả của chính mình.
		if (
			actor.role === 'student' &&
			questionRows.length > 0 &&
			(quiz.showAnswersAfter === 'never' ||
				(quiz.showAnswersAfter === 'after_due' && !duePassed))
		) {
			throw new ForbiddenException(
				'Bài kiểm tra này chưa cho phép xem lại đáp án.',
			);
		}
		const storedAnswers = await this.answers.find({
			where: { submissionId: id },
		});
		return {
			submissionId: id,
			submissionMode: quiz.submissionMode,
			status: submission.status,
			score: submission.score,
			maxScore: submission.maxScore,
			awaitingManualGrading: submission.status === 'submitted',
			teacherFeedback: submission.feedback,
			feedbackAt: submission.feedbackAt,
			isLate: submission.isLate,
			files: (
				await this.files.find({
					where: { submissionId: id },
					order: { createdAt: 'ASC' },
				})
			).map((row) => this.toSubmissionFile(row)),
			items: questionRows.map((question) => {
				const answer = storedAnswers.find(
					(row) => row.questionId === question.id,
				);
				return {
					questionId: question.id,
					content: question.content,
					type: question.questionType,
					points: question.points,
					earnedPoints: answer?.pointsAwarded ?? 0,
					isCorrect: answer?.isCorrect ?? false,
					selectedOptionIds: answer?.selectedOptionIds ?? [],
					correctOptionIds: question.options
						.filter((option) => option.isCorrect)
						.map((option) => option.id),
					explanation: question.explanation,
					options: question.options.map(({ id: optionId, content }) => ({
						id: optionId,
						content,
					})),
				};
			}),
		};
	}

	async updateFeedback(id: string, actor: AuthUser, dto: FeedbackDto) {
		const submission = await this.findSubmissionOrFail(id);
		const quiz = await this.findQuizOrFail(submission.quizId);
		await this.courseAccess.assertCanManage(quiz.courseId, actor);
		if (submission.status === 'in_progress')
			throw new BadRequestException(
				'Không thể phản hồi lượt làm đang diễn ra.',
			);
		// Bài nộp tệp không có điểm tự động, nên "chốt bài" mà không nhập điểm sẽ để lại một bài
		// `graded` với `score = NULL` — analytics đọc thành 0 và học viên thấy "đã chấm" mà không có
		// điểm. Chặn thẳng ở đây rẻ hơn nhiều so với việc đi dọn dữ liệu sai về sau.
		if (dto.score === undefined && submission.score === null) {
			throw new BadRequestException(
				'Vui lòng nhập điểm trước khi chốt bài nộp.',
			);
		}
		if (dto.score !== undefined) {
			if (submission.maxScore === null || dto.score > submission.maxScore)
				throw new BadRequestException(
					'Điểm phải nằm trong khoảng 0 đến điểm tối đa.',
				);
			submission.score = dto.score;
		}
		if (dto.teacherFeedback !== undefined)
			submission.feedback = dto.teacherFeedback;
		submission.status = 'graded';
		submission.gradedBy = actor.id;
		submission.gradedAt = new Date();
		submission.feedbackAt = new Date();
		const saved = await this.submissions.save(submission);
		return {
			id: saved.id,
			score: saved.score,
			status: saved.status,
			teacherFeedback: saved.feedback,
			feedbackAt: saved.feedbackAt,
			updatedAt: saved.updatedAt,
		};
	}

	private async toQuizSummary(quiz: Quiz, actor: AuthUser) {
		const questionCount = await this.questions.count({
			where: { quizId: quiz.id },
		});
		const points = await this.questions
			.createQueryBuilder('question')
			.select('COALESCE(SUM(question.points), 0)', 'total')
			.where('question.quizId = :id', { id: quiz.id })
			.getRawOne<{ total: string }>();
		const mine =
			actor.role === 'student'
				? await this.submissions.find({
						where: {
							quizId: quiz.id,
							userId: actor.id,
							status: In(['graded', 'submitted']),
						},
					})
				: [];
		return {
			id: quiz.id,
			courseId: quiz.courseId,
			lessonId: quiz.lessonId,
			title: quiz.title,
			description: quiz.description,
			status: this.statusOf(quiz),
			timeLimitMinutes:
				quiz.timeLimitSeconds == null ? null : quiz.timeLimitSeconds / 60,
			maxAttempts: quiz.maxAttempts,
			questionCount,
			submissionMode: quiz.submissionMode,
			// Điểm tối đa của **phần nộp tệp** (`NULL` = dùng mặc định 10); FE hiển thị và validate ô
			// nhập điểm bằng con số này thay vì tự đoán.
			fileMaxScore: quiz.maxScore,
			// Tổng điểm tối đa phụ thuộc chế độ: bài nộp tệp không có câu hỏi nên nếu chỉ lấy tổng
			// điểm câu hỏi thì `totalPoints` bằng 0 và màn hình giảng viên hiện "0 điểm".
			totalPoints: totalMaxScore(
				quiz.submissionMode,
				quiz.maxScore,
				Number(points?.total ?? 0),
			),
			passScore: quiz.passScore,
			shuffleQuestions: quiz.shuffleQuestions,
			openAt: quiz.availableFrom,
			closeAt: quiz.dueAt,
			myBestScore: mine.length
				? Math.max(...mine.map((item) => item.score ?? 0))
				: null,
			myAttemptCount:
				actor.role === 'student'
					? await this.submissions.count({
							where: { quizId: quiz.id, userId: actor.id },
						})
					: undefined,
			createdAt: quiz.createdAt,
			updatedAt: quiz.updatedAt,
		};
	}

	private async toAttempt(
		submission: Submission,
		quiz: Quiz,
		actor: AuthUser,
		includeAnswers = false,
	) {
		const loadedQuestions = await this.questionQuery(quiz.id, false);
		const questions = quiz.shuffleQuestions
			? [...loadedQuestions].sort(
					(left, right) =>
						this.stableOrder(`${submission.id}:${left.id}`) -
						this.stableOrder(`${submission.id}:${right.id}`),
				)
			: loadedQuestions;
		const stored = includeAnswers
			? await this.answers.find({ where: { submissionId: submission.id } })
			: [];
		// Tệp luôn kèm theo lượt làm (không phụ thuộc `includeAnswers`): học viên làm lại/mở lại trang
		// phải thấy đúng những tệp đã tải lên, nếu không họ sẽ tải trùng và vượt trần số tệp.
		const storedFiles = await this.files.find({
			where: { submissionId: submission.id },
			order: { createdAt: 'ASC' },
		});
		const result = {
			id: submission.id,
			quizId: quiz.id,
			userId: submission.userId,
			attemptNo: submission.attemptNo,
			submissionMode: quiz.submissionMode,
			fileMaxScore: quiz.maxScore,
			maxFiles: MAX_SUBMISSION_FILES,
			status: submission.status,
			startedAt: submission.startedAt,
			expiresAt: this.expiresAt(submission, quiz),
			files: storedFiles.map((row) => this.toSubmissionFile(row)),
			questions: questions.map((question) => ({
				id: question.id,
				content: question.content,
				type: question.questionType,
				points: question.points,
				orderIndex: question.orderIndex,
				options: question.options.map(({ id, content, orderIndex }) => ({
					id,
					content,
					orderIndex,
				})),
			})),
			createdAt: submission.createdAt,
			updatedAt: submission.updatedAt,
		};
		return includeAnswers
			? {
					...result,
					answers: stored.map((answer) => ({
						questionId: answer.questionId,
						selectedOptionIds: answer.selectedOptionIds,
					})),
				}
			: result;
	}

	private async questionQuery(
		quizId: string,
		includeCorrect: boolean,
	): Promise<QuestionWithOptions[]> {
		const questions = await this.questions.find({
			where: { quizId },
			order: { orderIndex: 'ASC' },
		});
		if (!questions.length) return [];
		const builder = this.options
			.createQueryBuilder('option')
			.where('option.questionId IN (:...questionIds)', {
				questionIds: questions.map((question) => question.id),
			})
			.orderBy('option.orderIndex', 'ASC');
		if (includeCorrect) builder.addSelect('option.isCorrect');
		const options = await builder.getMany();
		const optionsByQuestion = new Map<string, QuizOption[]>();
		for (const option of options) {
			const current = optionsByQuestion.get(option.questionId) ?? [];
			current.push(option);
			optionsByQuestion.set(option.questionId, current);
		}
		return questions.map((question) => ({
			...question,
			options: optionsByQuestion.get(question.id) ?? [],
		}));
	}

	private async loadQuestion(
		id: string,
		includeCorrect: boolean,
	): Promise<QuestionWithOptions> {
		const question = await this.questions.findOne({ where: { id } });
		if (!question) throw new NotFoundException('Không tìm thấy câu hỏi.');
		const builder = this.options
			.createQueryBuilder('option')
			.where('option.questionId = :questionId', { questionId: id })
			.orderBy('option.orderIndex', 'ASC');
		if (includeCorrect) builder.addSelect('option.isCorrect');
		return { ...question, options: await builder.getMany() };
	}

	private toQuestion(question: QuestionWithOptions, includeCorrect: boolean) {
		return {
			id: question.id,
			quizId: question.quizId,
			content: question.content,
			type: question.questionType,
			points: question.points,
			orderIndex: question.orderIndex,
			explanation: question.explanation,
			options: question.options.map((option) => ({
				id: option.id,
				content: option.content,
				...(includeCorrect ? { isCorrect: option.isCorrect } : {}),
				orderIndex: option.orderIndex,
			})),
			createdAt: question.createdAt,
			updatedAt: question.updatedAt,
		};
	}

	private async findQuizOrFail(id: string) {
		const quiz = await this.quizzes.findOne({
			where: { id, deletedAt: IsNull() },
		});
		if (!quiz) throw new NotFoundException('Không tìm thấy bài kiểm tra.');
		return quiz;
	}

	private async findQuestionOrFail(id: string) {
		const question = await this.questions.findOne({ where: { id } });
		if (!question) throw new NotFoundException('Không tìm thấy câu hỏi.');
		return question;
	}

	private async findSubmissionOrFail(id: string) {
		const submission = await this.submissions.findOne({ where: { id } });
		if (!submission) throw new NotFoundException('Không tìm thấy bài nộp.');
		return submission;
	}

	private async assertCanManageQuiz(id: string, actor: AuthUser) {
		const quiz = await this.findQuizOrFail(id);
		await this.courseAccess.assertCanManage(quiz.courseId, actor);
		return quiz;
	}

	private async assertCanViewQuiz(quiz: Quiz, actor: AuthUser) {
		if (actor.role === 'student') {
			if (!quiz.isPublished)
				throw new ForbiddenException('Bài kiểm tra chưa được công bố.');
			await this.assertStudentCanAttempt(quiz, actor, false);
			return;
		}
		await this.courseAccess.assertCanManage(quiz.courseId, actor);
	}

	private async assertStudentCanAttempt(
		quiz: Quiz,
		actor: AuthUser,
		checkWindow = true,
	) {
		if (actor.role !== 'student')
			throw new ForbiddenException('Chỉ học viên mới có thể làm bài.');
		if (!quiz.isPublished)
			throw new ForbiddenException('Bài kiểm tra chưa được công bố.');
		const enrollment = await this.enrollments.findOne({
			where: {
				courseId: quiz.courseId,
				userId: actor.id,
				status: Not('dropped'),
			},
		});
		if (!enrollment)
			throw new ForbiddenException('Bạn chưa ghi danh khoá học này.');
		const now = new Date();
		// `file`/`mixed` vẫn mở sau hạn nộp: bài nộp muộn được ghi `is_late = true` thay vì chặn
		// cứng, nếu không học viên mất luôn cơ hội nộp và giảng viên không thấy được ai nộp muộn.
		const closed = quiz.dueAt ? now > quiz.dueAt : false;
		if (
			checkWindow &&
			((quiz.availableFrom && now < quiz.availableFrom) ||
				(closed && !allowsLateSubmission(quiz.submissionMode)))
		) {
			throw new BadRequestException('Bài kiểm tra chưa mở hoặc đã đóng.');
		}
	}

	private async assertCanViewSubmission(
		submission: Submission,
		quiz: Quiz,
		actor: AuthUser,
	) {
		if (actor.role === 'student') {
			if (submission.userId !== actor.id)
				throw new ForbiddenException(
					'Bạn chỉ có thể xem bài nộp của chính mình.',
				);
			return;
		}
		await this.courseAccess.assertCanManage(quiz.courseId, actor);
	}

	private async assertNoSubmissions(quizId: string) {
		if ((await this.submissions.count({ where: { quizId } })) > 0) {
			throw new ConflictException(
				'Không thể sửa câu hỏi sau khi đã có bài nộp.',
			);
		}
	}

	private assertDateRange(openAt?: string | null, closeAt?: string | null) {
		if (openAt && closeAt && new Date(closeAt) <= new Date(openAt)) {
			throw new BadRequestException('Thời điểm đóng phải sau thời điểm mở.');
		}
	}

	private assertCorrectOptions(
		type: string,
		options: Array<{ isCorrect: boolean }>,
	) {
		if (options.length > 10)
			throw new BadRequestException('Mỗi câu hỏi tối đa 10 đáp án.');
		if (type === 'true_false' && options.length !== 2) {
			throw new BadRequestException('Câu Đúng / Sai phải có đúng hai đáp án.');
		}
		const correctCount = options.filter((option) => option.isCorrect).length;
		if (
			correctCount < 1 ||
			(type !== 'multiple_choice' && correctCount !== 1)
		) {
			throw new BadRequestException(
				'Số đáp án đúng không hợp lệ với loại câu hỏi.',
			);
		}
	}

	private expiresAt(submission: Submission, quiz: Quiz) {
		return quiz.timeLimitSeconds == null
			? null
			: new Date(submission.startedAt.getTime() + quiz.timeLimitSeconds * 1000);
	}

	private stableOrder(value: string) {
		let hash = 0;
		for (let index = 0; index < value.length; index += 1) {
			hash = (hash * 31 + value.charCodeAt(index)) | 0;
		}
		return hash;
	}

	private statusOf(quiz: Quiz): 'draft' | 'published' | 'closed' {
		if (!quiz.isPublished) return 'draft';
		return quiz.dueAt && quiz.dueAt < new Date() ? 'closed' : 'published';
	}
}
