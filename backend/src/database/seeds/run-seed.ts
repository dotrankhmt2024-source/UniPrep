import 'reflect-metadata';
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import type { DataSource, EntityManager, ObjectLiteral } from 'typeorm';
import { AppDataSource } from '../data-source';
import { AlertSetting } from '../../admin/entities/alert-setting.entity';
import { Category } from '../../course/entities/category.entity';
import { Course } from '../../course/entities/course.entity';
import { CourseSection } from '../../course/entities/course-section.entity';
import { Enrollment } from '../../course/entities/enrollment.entity';
import { Quiz } from '../../exercise/entities/quiz.entity';
import { QuizOption } from '../../exercise/entities/quiz-option.entity';
import { QuizQuestion } from '../../exercise/entities/quiz-question.entity';
import { Submission } from '../../exercise/entities/submission.entity';
import { SubmissionAnswer } from '../../exercise/entities/submission-answer.entity';
import { LearningEvent } from '../../learning-activity/entities/learning-event.entity';
import { Lesson } from '../../lesson/entities/lesson.entity';
import { LessonMaterial } from '../../lesson/entities/lesson-material.entity';
import { LessonProgress } from '../../lesson/entities/lesson-progress.entity';
import { ModelVersion } from '../../analytics/entities/model-version.entity';
import { User } from '../../user/entities/user.entity';
import type { EventType } from '../../common/types';
import {
	BEHAVIOR_PROFILES,
	CATEGORY_FIXTURES,
	COURSE_FIXTURES,
	DEMO_ACCOUNTS,
} from './seed-data';
import { createRandom, seededUuid } from './seed-random';

/**
 * Seed dữ liệu mẫu (E0-T6).
 *
 *     npm run seed                 # dùng SEED_RANDOM_SEED trong .env
 *     npm run seed -- --seed=123   # ghi đè seed ngẫu nhiên
 *
 * Nguyên tắc:
 * 1. **Idempotent** — mọi `id` sinh từ khoá tự nhiên (`seededUuid`) nên chạy lại
 *    là `ON CONFLICT (id) DO UPDATE`, không nhân đôi dữ liệu (DoD E0-T6).
 * 2. **Tái lập được** — mọi giá trị ngẫu nhiên lấy từ PRNG có seed; cùng seed cho
 *    cùng bộ dữ liệu (database-design.md §9.4). Riêng *mốc thời gian* được neo
 *    vào lúc chạy (`now`) để dashboard luôn có dữ liệu gần đây — đây là chủ ý,
 *    không phải mất tính tái lập của giá trị.
 * 3. **Không chạy ở production** — chặn bằng `NODE_ENV`.
 * 4. Mật khẩu lấy từ `SEED_DEMO_PASSWORD`, không hard-code.
 */

const STUDENT_COUNT = 30;
const MAJORS = [
	'Khoa học máy tính',
	'Kỹ thuật điện',
	'Kỹ thuật cơ khí',
	'Toán ứng dụng',
	'Vật lý kỹ thuật',
];
const DAY_MS = 24 * 60 * 60 * 1000;
const CHUNK_SIZE = 200;

const log = (message: string) => console.log(`[seed] ${message}`);

const parseSeedArg = (): number => {
	const arg = process.argv.find((value) => value.startsWith('--seed='));
	const fromArg = arg ? Number(arg.split('=')[1]) : Number.NaN;
	if (Number.isFinite(fromArg)) return fromArg;

	const fromEnv = Number(process.env.SEED_RANDOM_SEED);
	if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;

	return 20260926;
};

/** Upsert theo lô để không tạo câu INSERT quá dài với bảng nhiều dòng. */
const upsertChunked = async <T extends ObjectLiteral>(
	manager: EntityManager,
	entity: new () => T,
	rows: Array<Partial<T>>,
) => {
	for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
		const chunk = rows.slice(index, index + CHUNK_SIZE);
		await manager.getRepository(entity).upsert(chunk, ['id']);
	}
};

const daysAgo = (days: number, hour: number, minute: number): Date => {
	const date = new Date(Date.now() - days * DAY_MS);
	date.setHours(hour, minute, 0, 0);
	return date;
};

async function seed() {
	if (process.env.NODE_ENV === 'production') {
		throw new Error(
			'Seed chỉ dùng cho dev/staging: NODE_ENV đang là production nên script dừng lại.',
		);
	}

	const demoPassword = process.env.SEED_DEMO_PASSWORD;
	if (!demoPassword) {
		throw new Error(
			'Thiếu SEED_DEMO_PASSWORD trong .env — mật khẩu tài khoản demo không được hard-code trong code.',
		);
	}

	const randomSeed = parseSeedArg();
	const random = createRandom(randomSeed);
	log(`bắt đầu với seed ngẫu nhiên = ${randomSeed}`);

	const dataSource: DataSource = AppDataSource;
	await dataSource.initialize();
	const manager = dataSource.manager;

	try {
		const passwordHash = await bcrypt.hash(demoPassword, 10);

		// ---------------------------------------------------------------- users
		const users: Array<Partial<User>> = DEMO_ACCOUNTS.map((account) => ({
			id: seededUuid(`user:${account.key}`),
			email: account.email,
			passwordHash,
			fullName: account.fullName,
			role: account.role,
			status: 'active',
			preferredLocale: 'vi',
			emailVerifiedAt: daysAgo(60, 8, 0),
			studentCode: account.role === 'student' ? 'SV0000' : null,
			major: account.role === 'student' ? 'Khoa học máy tính' : null,
		}));

		const studentKeys: string[] = [];
		for (let index = 1; index <= STUDENT_COUNT; index += 1) {
			const key = `sv-${String(index).padStart(4, '0')}`;
			studentKeys.push(key);
			users.push({
				id: seededUuid(`user:${key}`),
				email: `sv${String(index).padStart(4, '0')}@example.test`,
				passwordHash,
				fullName: `Học viên mẫu ${String(index).padStart(2, '0')}`,
				role: 'student',
				status: 'active',
				preferredLocale: 'vi',
				emailVerifiedAt: daysAgo(60, 8, 0),
				studentCode: `SV${String(index).padStart(4, '0')}`,
				major: MAJORS[index % MAJORS.length],
				dateOfBirth: `200${index % 6}-0${(index % 9) + 1}-1${index % 9}`,
			});
		}
		await upsertChunked(manager, User, users);
		log(`users: ${users.length}`);

		const adminId = seededUuid('user:admin');
		const teacherIds = [
			seededUuid('user:teacher-1'),
			seededUuid('user:teacher-2'),
		];
		const demoStudentId = seededUuid('user:student-demo');

		// ----------------------------------------------------------- categories
		const categoryIdBySlug = new Map<string, string>();
		for (const category of CATEGORY_FIXTURES) {
			categoryIdBySlug.set(
				category.slug,
				seededUuid(`category:${category.slug}`),
			);
		}
		await upsertChunked(
			manager,
			Category,
			CATEGORY_FIXTURES.map((category) => ({
				id: categoryIdBySlug.get(category.slug),
				name: category.name,
				slug: category.slug,
				description: category.description,
				parentId: category.parentSlug
					? categoryIdBySlug.get(category.parentSlug)
					: null,
				orderIndex: category.orderIndex,
				isActive: true,
			})),
		);
		log(`categories: ${CATEGORY_FIXTURES.length}`);

		// ---------------------------------------------- courses, lessons, quiz
		const courseIdByCode = new Map<string, string>();
		const lessonIdsByCourse = new Map<string, string[]>();
		const lessons: Array<Partial<Lesson>> = [];
		const sections: Array<Partial<CourseSection>> = [];
		const materials: Array<Partial<LessonMaterial>> = [];
		const questions: Array<Partial<QuizQuestion>> = [];
		const options: Array<Partial<QuizOption>> = [];
		const quizzes: Array<Partial<Quiz>> = [];
		const questionIdByQuizAndIndex = new Map<string, string[]>();
		const correctOptionIdByQuestion = new Map<string, string>();

		COURSE_FIXTURES.forEach((fixture, courseIndex) => {
			const courseId = seededUuid(`course:${fixture.code}`);
			courseIdByCode.set(fixture.code, courseId);
			const publishedAt = daysAgo(56, 9, 0);

			let globalLessonOrder = 0;
			const lessonIds: string[] = [];

			fixture.sections.forEach((sectionFixture, sectionIndex) => {
				const sectionId = seededUuid(
					`section:${fixture.code}:${sectionIndex + 1}`,
				);
				sections.push({
					id: sectionId,
					courseId,
					title: sectionFixture.title,
					description: sectionFixture.description,
					orderIndex: sectionIndex + 1,
					isPublished: true,
					publishedAt,
				});

				sectionFixture.lessons.forEach((lessonFixture) => {
					globalLessonOrder += 1;
					const lessonId = seededUuid(
						`lesson:${fixture.code}:${globalLessonOrder}`,
					);
					lessonIds.push(lessonId);
					const slug = `${fixture.slug}-bai-${globalLessonOrder}`;

					lessons.push({
						id: lessonId,
						courseId,
						sectionId,
						title: lessonFixture.title,
						slug,
						summary: lessonFixture.summary,
						content: lessonFixture.content,
						contentFormat: 'html',
						// `order_index` là LỘ TRÌNH cấp khoá học (UNIQUE theo `course_id`,
						// database-design.md §3.2.6) — KHÔNG phải thứ tự trong chương, nên
						// phải dùng số thứ tự tích luỹ qua các chương.
						orderIndex: globalLessonOrder,
						estimatedMinutes: lessonFixture.estimatedMinutes,
						isPublished: true,
						publishedAt,
						createdBy: teacherIds[courseIndex % teacherIds.length],
					});

					materials.push({
						id: seededUuid(`material:${fixture.code}:${globalLessonOrder}:1`),
						lessonId,
						materialType: 'text',
						title: `Ghi chú bài ${globalLessonOrder}`,
						content: lessonFixture.summary,
						orderIndex: 1,
						isPublished: true,
					});

					if (lessonFixture.hasVideo) {
						materials.push({
							id: seededUuid(`material:${fixture.code}:${globalLessonOrder}:2`),
							lessonId,
							materialType: 'video',
							title: `Video bài ${globalLessonOrder}`,
							url: `https://example.test/video/${fixture.slug}-${globalLessonOrder}.mp4`,
							mimeType: 'video/mp4',
							durationSeconds: 600 + globalLessonOrder * 15,
							orderIndex: 2,
							isPublished: true,
						});
					}
				});
			});

			lessonIdsByCourse.set(fixture.code, lessonIds);

			const quizId = seededUuid(`quiz:${fixture.code}`);
			quizzes.push({
				id: quizId,
				courseId,
				lessonId: lessonIds[lessonIds.length - 1],
				sectionId: null,
				title: fixture.quiz.title,
				description: fixture.quiz.description,
				quizType: 'practice',
				timeLimitSeconds: fixture.quiz.timeLimitSeconds,
				maxAttempts: fixture.quiz.maxAttempts,
				passScore: fixture.quiz.passScore,
				shuffleQuestions: false,
				showAnswersAfter: 'after_submit',
				isPublished: true,
				createdBy: teacherIds[courseIndex % teacherIds.length],
			});

			const questionIds: string[] = [];
			fixture.quiz.questions.forEach((question, questionIndex) => {
				const questionId = seededUuid(
					`question:${fixture.code}:${questionIndex + 1}`,
				);
				questionIds.push(questionId);
				questions.push({
					id: questionId,
					quizId,
					questionType: 'single_choice',
					content: question.content,
					explanation: question.explanation,
					points: 1,
					orderIndex: questionIndex + 1,
				});

				question.options.forEach((optionContent, optionIndex) => {
					const optionId = seededUuid(
						`option:${fixture.code}:${questionIndex + 1}:${optionIndex + 1}`,
					);
					if (optionIndex === question.correctIndex) {
						correctOptionIdByQuestion.set(questionId, optionId);
					}
					options.push({
						id: optionId,
						questionId,
						content: optionContent,
						isCorrect: optionIndex === question.correctIndex,
						orderIndex: optionIndex + 1,
					});
				});
			});
			questionIdByQuizAndIndex.set(quizId, questionIds);
		});

		await upsertChunked(
			manager,
			Course,
			COURSE_FIXTURES.map((fixture, courseIndex) => ({
				id: courseIdByCode.get(fixture.code),
				code: fixture.code,
				title: fixture.title,
				slug: fixture.slug,
				summary: fixture.summary,
				description: fixture.description,
				categoryId: categoryIdBySlug.get(fixture.categorySlug) ?? null,
				ownerId: teacherIds[courseIndex % teacherIds.length],
				level: fixture.level,
				language: 'vi',
				semester: '1/2026-2027',
				status: 'published',
				visibility: 'public',
				estimatedHours: fixture.estimatedHours,
				enrollmentOpen: true,
				publishedAt: daysAgo(56, 9, 0),
				createdBy: teacherIds[courseIndex % teacherIds.length],
			})),
		);
		await upsertChunked(manager, CourseSection, sections);
		await upsertChunked(manager, Lesson, lessons);
		await upsertChunked(manager, LessonMaterial, materials);
		await upsertChunked(manager, Quiz, quizzes);
		await upsertChunked(manager, QuizQuestion, questions);
		await upsertChunked(manager, QuizOption, options);
		log(
			`courses: ${COURSE_FIXTURES.length}, sections: ${sections.length}, lessons: ${lessons.length}, materials: ${materials.length}, quiz: ${quizzes.length}, questions: ${questions.length}, options: ${options.length}`,
		);

		// ---------------------------------------- enrollments, progress, events
		const primaryCode = COURSE_FIXTURES[0].code;
		const primaryCourseId = courseIdByCode.get(primaryCode) as string;
		const primaryLessons = lessonIdsByCourse.get(primaryCode) as string[];
		const primaryQuizId = seededUuid(`quiz:${primaryCode}`);
		const primaryQuestionIds = questionIdByQuizAndIndex.get(
			primaryQuizId,
		) as string[];

		const enrollments: Array<Partial<Enrollment>> = [];
		const progressRows: Array<Partial<LessonProgress>> = [];
		const eventRows: Array<Partial<LearningEvent>> = [];
		const submissionRows: Array<Partial<Submission>> = [];
		const answerRows: Array<Partial<SubmissionAnswer>> = [];

		studentKeys.forEach((studentKey, studentIndex) => {
			const studentId = seededUuid(`user:${studentKey}`);
			const profile =
				BEHAVIOR_PROFILES[studentIndex % BEHAVIOR_PROFILES.length];
			const enrolledAt = daysAgo(55, 8, 30 + (studentIndex % 20));
			const minDaysAgo = profile.recencyDays;

			const completedCount = Math.max(
				0,
				Math.min(
					primaryLessons.length,
					Math.round(
						profile.completionRatio * primaryLessons.length + random.int(-2, 2),
					),
				),
			);

			// Hoàn thành tuần tự từ bài đầu — khớp cách học thật và để "resume"
			// (E4-T3) có nghĩa: bài chưa xong luôn nằm ngay sau bài cuối đã xong.
			let lastActivityDay = minDaysAgo;
			primaryLessons.forEach((lessonId, lessonIndex) => {
				if (lessonIndex >= completedCount + 1) return;

				const isCompleted = lessonIndex < completedCount;
				const completedDaysAgo = Math.max(
					minDaysAgo,
					54 - lessonIndex * 3 - random.int(0, 2),
				);
				const viewedDay = Math.min(56, completedDaysAgo + random.int(0, 2));
				lastActivityDay = Math.min(lastActivityDay, viewedDay);

				progressRows.push({
					id: seededUuid(`progress:${studentKey}:${lessonIndex + 1}`),
					enrollmentId: seededUuid(`enrollment:${studentKey}:${primaryCode}`),
					userId: studentId,
					courseId: primaryCourseId,
					lessonId,
					status: isCompleted ? 'completed' : 'in_progress',
					firstViewedAt: daysAgo(viewedDay, 9, 0),
					lastViewedAt: daysAgo(completedDaysAgo, 20, 0),
					completedAt: isCompleted ? daysAgo(completedDaysAgo, 20, 15) : null,
					timeSpentSeconds: random.int(6, 45) * 60,
					lastPositionSeconds: isCompleted ? null : random.int(60, 600),
					viewCount: random.int(1, 4),
				});

				// Sự kiện sinh cùng lúc với tiến độ để hai nguồn không mâu thuẫn (§9.3).
				const baseHour = 8 + random.int(0, 12);
				const sessionId = seededUuid(
					`session:${studentKey}:${completedDaysAgo}`,
				);
				const pushEvent = (
					eventType: EventType,
					hourOffset: number,
					durationSeconds: number | null,
				) => {
					eventRows.push({
						id: seededUuid(
							`event:${studentKey}:${lessonIndex + 1}:${eventType}`,
						),
						userId: studentId,
						courseId: primaryCourseId,
						lessonId,
						enrollmentId: seededUuid(`enrollment:${studentKey}:${primaryCode}`),
						eventType,
						occurredAt: daysAgo(
							completedDaysAgo,
							(baseHour + hourOffset) % 24,
							random.int(0, 59),
						),
						receivedAt: daysAgo(
							completedDaysAgo,
							(baseHour + hourOffset) % 24,
							random.int(0, 59),
						),
						sessionId,
						durationSeconds,
						metadata: {},
					});
				};

				pushEvent('lesson_started', 0, null);
				pushEvent('material_viewed', 0, random.int(3, 20) * 60);
				if (isCompleted) {
					pushEvent('lesson_completed', 1, random.int(6, 45) * 60);
				}
			});

			// Đăng nhập rải rác theo tuần — nguồn cho feature `recency`.
			const loginCount = profile.eventsPerWeek;
			for (let loginIndex = 0; loginIndex < loginCount; loginIndex += 1) {
				const day = Math.max(minDaysAgo, random.int(minDaysAgo, 56));
				eventRows.push({
					id: seededUuid(`event:${studentKey}:login:${loginIndex + 1}`),
					userId: studentId,
					courseId: primaryCourseId,
					enrollmentId: seededUuid(`enrollment:${studentKey}:${primaryCode}`),
					eventType: 'login',
					occurredAt: daysAgo(day, random.int(6, 22), random.int(0, 59)),
					receivedAt: daysAgo(day, random.int(6, 22), random.int(0, 59)),
					sessionId: seededUuid(`session:${studentKey}:${day}`),
					durationSeconds: null,
					metadata: {},
				});
			}

			enrollments.push({
				id: seededUuid(`enrollment:${studentKey}:${primaryCode}`),
				userId: studentId,
				courseId: primaryCourseId,
				status:
					completedCount === primaryLessons.length ? 'completed' : 'active',
				source: 'self',
				enrolledAt,
				startedAt: enrolledAt,
				lastActivityAt: daysAgo(lastActivityDay, 20, 0),
				completedAt:
					completedCount === primaryLessons.length
						? daysAgo(lastActivityDay, 20, 0)
						: null,
				progressPercent: Number(
					((completedCount / primaryLessons.length) * 100).toFixed(2),
				),
			});

			// Một nửa số học viên có bài nộp quiz đã chấm — dữ liệu cho `avg_score`.
			if (studentIndex % 2 === 0) {
				const [minScore, maxScore] = profile.quizScoreRange;
				const score = random.int(minScore, maxScore);
				const submissionId = seededUuid(
					`submission:${studentKey}:${primaryCode}`,
				);
				const submittedDaysAgo = Math.max(minDaysAgo, random.int(2, 40));

				submissionRows.push({
					id: submissionId,
					quizId: primaryQuizId,
					userId: studentId,
					enrollmentId: seededUuid(`enrollment:${studentKey}:${primaryCode}`),
					courseId: primaryCourseId,
					attemptNo: 1,
					status: 'graded',
					score,
					maxScore: primaryQuestionIds.length,
					correctCount: score,
					totalQuestions: primaryQuestionIds.length,
					startedAt: daysAgo(submittedDaysAgo, 14, 0),
					submittedAt: daysAgo(submittedDaysAgo, 14, 30),
					gradedAt: daysAgo(
						submittedDaysAgo - 1 < 0 ? 0 : submittedDaysAgo - 1,
						9,
						0,
					),
					durationSeconds: random.int(300, 900),
					gradedBy: teacherIds[0],
					isLate: false,
				});

				primaryQuestionIds.forEach((questionId, questionIndex) => {
					const isCorrect = questionIndex < score;
					const correctOptionId = correctOptionIdByQuestion.get(questionId);
					answerRows.push({
						id: seededUuid(
							`answer:${studentKey}:${primaryCode}:${questionIndex + 1}`,
						),
						submissionId,
						questionId,
						// Câu sai vẫn ghi một lựa chọn: chọn đáp án sai đầu tiên khác đáp án đúng.
						selectedOptionIds: [
							isCorrect
								? (correctOptionId as string)
								: seededUuid(
										`option:${primaryCode}:${questionIndex + 1}:${
											((COURSE_FIXTURES[0].quiz.questions[questionIndex]
												.correctIndex +
												1) %
												4) +
											1
										}`,
									),
						],
						isCorrect,
						pointsAwarded: isCorrect ? 1 : 0,
						timeSpentSeconds: random.int(20, 90),
					});
				});
			}
		});

		// Học viên demo (tài khoản đăng nhập trình diễn) — đang học dở khoá đầu.
		const demoCompleted = 6;
		enrollments.push({
			id: seededUuid(`enrollment:student-demo:${primaryCode}`),
			userId: demoStudentId,
			courseId: primaryCourseId,
			status: 'active',
			source: 'self',
			enrolledAt: daysAgo(14, 8, 0),
			startedAt: daysAgo(14, 8, 5),
			lastActivityAt: daysAgo(1, 20, 0),
			progressPercent: Number(
				((demoCompleted / primaryLessons.length) * 100).toFixed(2),
			),
		});
		primaryLessons.slice(0, demoCompleted).forEach((lessonId, index) => {
			progressRows.push({
				id: seededUuid(`progress:student-demo:${index + 1}`),
				enrollmentId: seededUuid(`enrollment:student-demo:${primaryCode}`),
				userId: demoStudentId,
				courseId: primaryCourseId,
				lessonId,
				status: 'completed',
				firstViewedAt: daysAgo(13 - index, 9, 0),
				lastViewedAt: daysAgo(13 - index, 10, 0),
				completedAt: daysAgo(13 - index, 10, 15),
				timeSpentSeconds: random.int(10, 40) * 60,
				viewCount: random.int(1, 3),
			});
		});

		// Khoá thứ hai: một nửa số học viên ghi danh để catalog có dữ liệu đa dạng.
		const secondaryCode = COURSE_FIXTURES[1].code;
		const secondaryCourseId = courseIdByCode.get(secondaryCode) as string;
		studentKeys.forEach((studentKey, studentIndex) => {
			if (studentIndex % 2 !== 0) return;
			const enrolledAt = daysAgo(30, 9, studentIndex % 30);
			enrollments.push({
				id: seededUuid(`enrollment:${studentKey}:${secondaryCode}`),
				userId: seededUuid(`user:${studentKey}`),
				courseId: secondaryCourseId,
				status: 'active',
				source: 'self',
				enrolledAt,
				startedAt: enrolledAt,
				lastActivityAt: daysAgo(random.int(1, 20), 19, 0),
				progressPercent: random.int(0, 60),
			});
		});

		await upsertChunked(manager, Enrollment, enrollments);
		await upsertChunked(manager, LessonProgress, progressRows);
		await upsertChunked(manager, LearningEvent, eventRows);
		await upsertChunked(manager, Submission, submissionRows);
		await upsertChunked(manager, SubmissionAnswer, answerRows);
		log(
			`enrollments: ${enrollments.length}, lesson_progress: ${progressRows.length}, learning_events: ${eventRows.length}, submissions: ${submissionRows.length}, submission_answers: ${answerRows.length}`,
		);

		// ------------------------------------------------- model + alert config
		await upsertChunked(manager, ModelVersion, [
			{
				id: seededUuid('model-version:rule-based-v0'),
				name: 'risk-rule-based',
				version: 'v0',
				algorithm: 'rule-based',
				featureList: [
					'recency',
					'completion_rate',
					'avg_score',
					'score_trend',
					'attempt_anomaly',
					'on_task_time',
				],
				hyperparams: null,
				// `metrics` để NULL cho tới khi đo thật — không bịa số liệu (docs/README.md §4.3).
				metrics: null,
				isActive: true,
				notes:
					'Baseline rule-based v0 cho E9-T2; ngưỡng đọc từ alert_settings, không hard-code.',
				createdBy: adminId,
			},
		]);

		await upsertChunked(manager, AlertSetting, [
			{
				id: seededUuid('alert-setting:global'),
				scope: 'global',
				courseId: null,
				thresholdMedium: 0.4,
				thresholdHigh: 0.7,
				lookbackDays: 14,
				inactivityDays: 7,
				minEventsForPrediction: 5,
				retryAttemptThreshold: 3,
				autoInterventionEnabled: false,
				notifyStudent: true,
				notifyInstructor: true,
				scheduleCron: '0 2 * * *',
				isEnabled: true,
				updatedById: adminId,
			},
		]);
		log('model_versions: 1, alert_settings: 1');

		log('hoàn tất — chạy lại lệnh này sẽ không nhân đôi dữ liệu.');
	} finally {
		await dataSource.destroy();
	}
}

seed().catch((error) => {
	console.error('[seed] thất bại:', error);
	process.exit(1);
});
