import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import { CourseSection } from '../course/entities/course-section.entity';
import { Course } from '../course/entities/course.entity';
import { Enrollment } from '../course/entities/enrollment.entity';
import { Quiz } from '../exercise/entities/quiz.entity';
import { LessonProgress } from '../lesson/entities/lesson-progress.entity';
import { Lesson } from '../lesson/entities/lesson.entity';
import { CatalogContentService } from './catalog-content.service';
import { buildQuizMessages } from './catalog-content.prompt';

export interface QuizScopeLesson {
	id: string;
	title: string;
	completed: boolean;
	/** Bài đã có nội dung (soạn tay hoặc AI đã soạn) — câu hỏi bám sát hơn bài chỉ có tên. */
	hasContent: boolean;
}

export interface QuizScopeSection {
	id: string;
	title: string;
	orderIndex: number;
	lessons: QuizScopeLesson[];
}

export interface QuizScope {
	course: { id: string; code: string; title: string };
	sections: QuizScopeSection[];
	totalLessons: number;
	completedLessons: number;
}

export const CUSTOM_QUIZ_MAX_LESSONS = 40;
export const CUSTOM_QUIZ_DEFAULT_QUESTIONS = 10;
const CONTEXT_CHARS = 12000;
const ACTIVE_ENROLLMENT = ['active', 'completed'] as const;

/** Bỏ thẻ HTML của bài soạn bằng trình soạn thảo để đưa văn bản cho model. */
const toPlainText = (content: string, format: string): string =>
	format === 'markdown'
		? content
		: content
				.replace(/<[^>]+>/g, ' ')
				.replace(/&nbsp;/g, ' ')
				.replace(/\s+/g, ' ');

/**
 * Quiz "theo tiến độ" do học viên tự chọn phạm vi: hiện mọi bài của khoá (đánh dấu sẵn bài đã
 * hoàn thành), học viên chỉnh rồi AI ra đề **chỉ** từ các bài đã chọn.
 *
 * Mỗi lần tạo là một quiz cá nhân (`quizzes.personal_user_id`) — chỉ chủ nhân thấy và làm — nên
 * luồng làm bài, chấm điểm, xem đáp án dùng lại nguyên `ExerciseService`. Dùng được cho cả khoá mở
 * từ Catalog lẫn khoá giảng viên tự soạn.
 */
@Injectable()
export class CustomQuizService {
	private readonly logger = new Logger(CustomQuizService.name);

	constructor(
		private readonly content: CatalogContentService,
		private readonly dataSource: DataSource,
		@InjectRepository(Course) private readonly courses: Repository<Course>,
		@InjectRepository(CourseSection)
		private readonly sections: Repository<CourseSection>,
		@InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
		@InjectRepository(LessonProgress)
		private readonly progress: Repository<LessonProgress>,
		@InjectRepository(Enrollment)
		private readonly enrollments: Repository<Enrollment>,
	) {}

	async getScope(courseId: string, actor: AuthUser): Promise<QuizScope> {
		const { course, enrollment } = await this.assertEnrolled(courseId, actor);
		const [sections, lessons, done] = await Promise.all([
			this.sections.find({
				where: { courseId, isPublished: true },
				order: { orderIndex: 'ASC' },
			}),
			this.publishedLessons(courseId),
			this.progress.find({
				where: { enrollmentId: enrollment.id, status: 'completed' },
				select: { lessonId: true },
			}),
		]);
		const completed = new Set(done.map((row) => row.lessonId));

		const result: QuizScopeSection[] = sections
			.map((section) => ({
				id: section.id,
				title: section.title,
				orderIndex: section.orderIndex,
				lessons: lessons
					.filter((lesson) => lesson.sectionId === section.id)
					.map((lesson) => ({
						id: lesson.id,
						title: lesson.title,
						completed: completed.has(lesson.id),
						hasContent: Boolean(lesson.content?.trim()),
					})),
			}))
			.filter((section) => section.lessons.length > 0);

		const all = result.flatMap((section) => section.lessons);
		return {
			course: { id: course.id, code: course.code, title: course.title },
			sections: result,
			totalLessons: all.length,
			completedLessons: all.filter((lesson) => lesson.completed).length,
		};
	}

	async create(
		courseId: string,
		lessonIds: string[],
		questionCount: number,
		actor: AuthUser,
	): Promise<{ quizId: string }> {
		const { course } = await this.assertEnrolled(courseId, actor);
		const unique = [...new Set(lessonIds)];
		if (!unique.length)
			throw new BadRequestException('Hãy chọn ít nhất một bài học.');
		if (unique.length > CUSTOM_QUIZ_MAX_LESSONS) {
			throw new BadRequestException(
				`Chỉ chọn tối đa ${CUSTOM_QUIZ_MAX_LESSONS} bài cho một quiz.`,
			);
		}

		const lessons = (await this.publishedLessons(courseId)).filter((lesson) =>
			unique.includes(lesson.id),
		);
		if (lessons.length !== unique.length) {
			throw new BadRequestException(
				'Có bài học không thuộc khoá này hoặc chưa công bố.',
			);
		}
		const sectionTitle = new Map(
			(
				await this.sections.find({
					where: { id: In([...new Set(lessons.map((l) => l.sectionId))]) },
				})
			).map((section) => [section.id, section.title]),
		);

		// Chia đều ngân sách ngữ cảnh cho các bài; bài chưa có nội dung chỉ góp tên bài.
		const perLesson = Math.max(400, Math.floor(CONTEXT_CHARS / lessons.length));
		const excerpts = lessons
			.filter((lesson) => lesson.content?.trim())
			.map(
				(lesson) =>
					`### ${lesson.title}\n${toPlainText(lesson.content!, lesson.contentFormat).slice(0, perLesson)}`,
			)
			.join('\n\n')
			.slice(0, CONTEXT_CHARS);

		const messages = buildQuizMessages({
			courseCode: course.code,
			courseName: course.title,
			topicTitle: 'Các bài học do học viên chọn',
			skills: lessons.map(
				(lesson) =>
					`${sectionTitle.get(lesson.sectionId) ?? 'Chương'} — ${lesson.title}`,
			),
			outcomes: [],
			lessonExcerpts: excerpts,
			questionCount,
		});
		const { questions, durationMs } = await this.content.generateQuestions(
			messages,
			questionCount,
		);

		const now = new Date();
		const stamp = now.toLocaleString('vi-VN', {
			timeZone: 'Asia/Ho_Chi_Minh',
			hour: '2-digit',
			minute: '2-digit',
			day: '2-digit',
			month: '2-digit',
		});
		const quizId = await this.dataSource.transaction(async (manager) => {
			const quiz = await manager.save(
				manager.create(Quiz, {
					courseId,
					lessonId: null,
					sectionId: null,
					title: `Quiz theo tiến độ · ${lessons.length} bài · ${stamp}`,
					description:
						`Phạm vi: ${lessons.map((l) => l.title).join('; ')}`.slice(0, 2000),
					quizType: 'practice',
					timeLimitSeconds: null,
					maxAttempts: null,
					passScore: null,
					shuffleQuestions: false,
					showAnswersAfter: 'after_submit',
					submissionMode: 'quiz',
					maxScore: null,
					availableFrom: null,
					dueAt: null,
					isPublished: true,
					createdBy: actor.id,
					deletedAt: null,
					catalogKey: null,
					personalUserId: actor.id,
					scopeLessonIds: lessons.map((lesson) => lesson.id),
				}),
			);
			await this.content.insertQuestions(manager, quiz.id, questions);
			return quiz.id;
		});

		this.logger.log(
			`Quiz theo tiến độ ${quizId}: ${questions.length} câu từ ${lessons.length} bài (${durationMs} ms)`,
		);
		return { quizId };
	}

	private publishedLessons(courseId: string): Promise<Lesson[]> {
		return this.lessons.find({
			where: { courseId, isPublished: true, deletedAt: IsNull() },
			order: { orderIndex: 'ASC' },
		});
	}

	private async assertEnrolled(courseId: string, actor: AuthUser) {
		if (actor.role !== 'student') {
			throw new ForbiddenException(
				'Chỉ học viên mới tạo được quiz theo tiến độ.',
			);
		}
		const course = await this.courses.findOne({
			where: { id: courseId, deletedAt: IsNull() },
		});
		if (!course) throw new NotFoundException('Không tìm thấy khoá học.');
		const enrollment = await this.enrollments.findOne({
			where: { courseId, userId: actor.id, status: In([...ACTIVE_ENROLLMENT]) },
		});
		if (!enrollment)
			throw new ForbiddenException('Bạn chưa ghi danh khoá học này.');
		return { course, enrollment };
	}
}
