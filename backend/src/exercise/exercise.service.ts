import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import { buildPageMeta, toSkip } from '../common/utils/pagination.util';
import { CourseAccessService } from '../course/course-access.service';
import { Course } from '../course/entities/course.entity';
import { Enrollment } from '../course/entities/enrollment.entity';
import { Quiz } from './entities/quiz.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { QuizOption } from './entities/quiz-option.entity';
import { Submission } from './entities/submission.entity';
import { SubmissionAnswer } from './entities/submission-answer.entity';
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

type QuestionWithOptions = QuizQuestion & { options: QuizOption[] };

@Injectable()
export class ExerciseService {
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
		private readonly courseAccess: CourseAccessService,
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
		if ((await this.questions.count({ where: { quizId: id } })) === 0) {
			throw new BadRequestException(
				'Bài kiểm tra phải có ít nhất một câu hỏi.',
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
		if (!questions.length)
			throw new BadRequestException('Bài kiểm tra chưa có câu hỏi.');
		const submission = await this.submissions.save(
			this.submissions.create({
				quizId,
				userId: actor.id,
				enrollmentId: enrollment.id,
				courseId: quiz.courseId,
				attemptNo: attemptCount + 1,
				status: 'in_progress',
				maxScore: questions.reduce(
					(sum, question) => sum + Number(question.points),
					0,
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
		const expiresAt = this.expiresAt(submission, quiz);
		if (expiresAt && new Date() >= expiresAt) {
			submission.status = 'expired';
			await this.submissions.save(submission);
			throw new ConflictException('Lượt làm bài đã hết hạn.');
		}
		if (quiz.dueAt && new Date() > quiz.dueAt) {
			submission.status = 'expired';
			await this.submissions.save(submission);
			throw new ConflictException('Bài kiểm tra đã đóng.');
		}

		const questions = await this.questionQuery(quiz.id, true);
		const grading = gradeObjectiveQuestions(questions, dto.answers);
		const answerRows = grading.answers;
		const { score, correctCount } = grading;

		const submittedAt = new Date();
		const elapsed = Math.max(
			0,
			Math.floor(
				(submittedAt.getTime() - submission.startedAt.getTime()) / 1000,
			),
		);
		const late = !!quiz.dueAt && submittedAt > quiz.dueAt;
		await this.dataSource.transaction(async (manager) => {
			await manager.getRepository(SubmissionAnswer).save(
				answerRows.map((answer) =>
					manager.getRepository(SubmissionAnswer).create({
						submissionId: submission.id,
						questionId: answer.questionId,
						selectedOptionIds: answer.selectedOptionIds,
						isCorrect: answer.isCorrect,
						pointsAwarded: answer.pointsAwarded,
					}),
				),
			);
			submission.score = score;
			submission.maxScore = questions.reduce(
				(sum, question) => sum + Number(question.points),
				0,
			);
			submission.correctCount = correctCount;
			submission.totalQuestions = questions.length;
			submission.status = 'graded';
			submission.submittedAt = submittedAt;
			submission.gradedAt = submittedAt;
			submission.durationSeconds = elapsed;
			submission.isLate = late;
			await manager.getRepository(Submission).save(submission);
		});
		return {
			id: submission.id,
			attemptId: submission.id,
			quizId: quiz.id,
			userId: actor.id,
			status: submission.status,
			score: submission.score,
			maxScore: submission.maxScore,
			correctCount,
			totalQuestions: questions.length,
			passed: quiz.passScore == null ? null : score >= quiz.passScore,
			autoGraded: true,
			submittedAt,
			gradedAt: submittedAt,
			attemptNo: submission.attemptNo,
			durationSeconds: elapsed,
		};
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
				status: item.status,
				score: item.score,
				maxScore: item.maxScore,
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
			status: submission.status,
			score: submission.score,
			maxScore: submission.maxScore,
			correctCount: submission.correctCount,
			totalQuestions: submission.totalQuestions,
			durationSeconds: submission.durationSeconds,
			submittedAt: submission.submittedAt,
			teacherFeedback: submission.feedback,
			feedbackAt: submission.feedbackAt,
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
		if (
			actor.role === 'student' &&
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
		const questionRows = await this.questionQuery(quiz.id, true);
		return {
			submissionId: id,
			score: submission.score,
			maxScore: submission.maxScore,
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
			totalPoints: Number(points?.total ?? 0),
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
		const result = {
			id: submission.id,
			quizId: quiz.id,
			userId: submission.userId,
			attemptNo: submission.attemptNo,
			status: submission.status,
			startedAt: submission.startedAt,
			expiresAt: this.expiresAt(submission, quiz),
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
		if (
			checkWindow &&
			((quiz.availableFrom && now < quiz.availableFrom) ||
				(quiz.dueAt && now > quiz.dueAt))
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
