import {
	Injectable,
	Logger,
	ServiceUnavailableException,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { PageMeta } from '../common/dto/page-meta.dto';
import type { EnrollmentStatus } from '../common/types';
import { CatalogService } from '../catalog/catalog.service';
import type { LocalizedText, SkillGraph } from '../catalog/catalog.types';
import { slugify } from '../course/course.util';
import { CourseSection } from '../course/entities/course-section.entity';
import { Course } from '../course/entities/course.entity';
import { Enrollment } from '../course/entities/enrollment.entity';
import { Quiz } from '../exercise/entities/quiz.entity';
import { Lesson } from '../lesson/entities/lesson.entity';
import { User } from '../user/entities/user.entity';

export interface LearnerCatalogCourse {
	courseCode: string;
	latestVersion: string;
	name: LocalizedText;
	credits: number | null;
	facultyCode: string | null;
	/** Khoá học trong UniPrep đã được mở từ đề cương này (nếu có). */
	course: { id: string; catalogRef: string } | null;
	myEnrollment: { id: string; status: EnrollmentStatus } | null;
}

export interface LearnerCatalogQuery {
	search?: string;
	faculty?: string;
	page: number;
	take: number;
}

const truncate = (
	value: string | null | undefined,
	max: number,
): string | null => {
	const text = value?.trim();
	if (!text) return null;
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const PG_UNIQUE_VIOLATION = '23505';

/**
 * Khoá học sinh viên thấy = **mọi môn trong Catalog**, đọc trực tiếp (không sao chép danh mục).
 *
 * Khi một môn được mở lần đầu, UniPrep tạo một "phiên bản học" của môn đó trong DB của mình —
 * khoá học + chương (chủ đề) + bài (kỹ năng) + bài tập (mỗi chủ đề một bài) — vì ghi danh, tiến độ,
 * bài nộp đều cần khoá ngoại tới `courses`/`lessons`/`quizzes`. Chỉ lưu khung và khoá tham chiếu;
 * nội dung bài và câu hỏi được AI sinh khi người học mở tới (`CatalogContentService`).
 */
@Injectable()
export class CatalogCourseService {
	private readonly logger = new Logger(CatalogCourseService.name);
	/** Hai request mở cùng một môn cùng lúc chỉ tạo khoá học một lần. */
	private readonly opening = new Map<string, Promise<string>>();

	constructor(
		private readonly catalog: CatalogService,
		private readonly dataSource: DataSource,
		private readonly config: ConfigService,
		@InjectRepository(Course) private readonly courses: Repository<Course>,
		@InjectRepository(Enrollment)
		private readonly enrollments: Repository<Enrollment>,
		@InjectRepository(User) private readonly users: Repository<User>,
	) {}

	async listForLearner(
		query: LearnerCatalogQuery,
		actor: AuthUser,
	): Promise<{ items: LearnerCatalogCourse[]; meta: PageMeta }> {
		const result = await this.catalog.searchCourses({
			q: query.search,
			facultyCode: query.faculty,
			page: query.page,
			take: query.take,
		});
		const codes = result.items.map((item) => item.courseCode);

		const opened = codes.length
			? await this.courses
					.createQueryBuilder('course')
					.where('course.deletedAt IS NULL')
					.andWhere(`split_part(course.catalogRef, '@', 1) IN (:...codes)`, {
						codes,
					})
					.getMany()
			: [];
		const enrollments = opened.length
			? await this.enrollments.find({
					where: { userId: actor.id, courseId: In(opened.map((c) => c.id)) },
				})
			: [];
		const enrollmentByCourse = new Map(enrollments.map((e) => [e.courseId, e]));

		const items = result.items.map((item): LearnerCatalogCourse => {
			const candidates = opened.filter(
				(course) => course.catalogRef?.split('@')[0] === item.courseCode,
			);
			// Ưu tiên khoá người học đã ghi danh, rồi tới khoá của phiên bản hiện hành.
			const course =
				candidates.find((c) => enrollmentByCourse.has(c.id)) ??
				candidates.find(
					(c) => c.catalogRef === `${item.courseCode}@${item.latestVersion}`,
				) ??
				candidates[0] ??
				null;
			const enrollment = course ? enrollmentByCourse.get(course.id) : undefined;
			return {
				courseCode: item.courseCode,
				latestVersion: item.latestVersion,
				name: item.name,
				credits: item.credits,
				facultyCode: item.facultyCode,
				course: course
					? { id: course.id, catalogRef: course.catalogRef! }
					: null,
				myEnrollment: enrollment
					? { id: enrollment.id, status: enrollment.status }
					: null,
			};
		});

		return { items, meta: result.meta };
	}

	/** Trả `id` khoá học UniPrep của môn (phiên bản hiện hành), tạo mới nếu chưa có. */
	async open(courseCode: string): Promise<{ courseId: string }> {
		const graph = await this.catalog.getSkillGraph(courseCode);
		const existing = await this.findByRef(graph.courseRef);
		if (existing) return { courseId: existing.id };

		let pending = this.opening.get(graph.courseRef);
		if (!pending) {
			pending = this.materialize(graph).finally(() =>
				this.opening.delete(graph.courseRef),
			);
			this.opening.set(graph.courseRef, pending);
		}
		return { courseId: await pending };
	}

	private findByRef(ref: string): Promise<Course | null> {
		return this.courses.findOne({
			where: { catalogRef: ref, deletedAt: IsNull() },
		});
	}

	private async materialize(graph: SkillGraph): Promise<string> {
		if (!graph.skills.length) {
			throw new UnprocessableEntityException(
				`Đề cương môn ${graph.courseCode} chưa đủ nội dung để tạo khoá học.`,
			);
		}
		const outline = await this.catalog.getOutline(
			graph.courseCode,
			graph.version,
		);
		const ownerId = await this.resolveOwnerId();
		const content = outline.content;
		const title =
			truncate(graph.name.vi, 255) ??
			truncate(graph.name.en, 255) ??
			graph.courseCode;
		const now = new Date();

		try {
			return await this.dataSource.transaction(async (manager) => {
				const code = (await manager.exists(Course, {
					where: { code: graph.courseCode },
				}))
					? graph.courseRef
					: graph.courseCode;
				let slug = slugify(`${graph.courseCode} ${title}`).slice(0, 270);
				if (await manager.exists(Course, { where: { slug } })) {
					slug = `${slug.slice(0, 260)}-${slugify(graph.version)}`;
				}

				const course = await manager.save(
					manager.create(Course, {
						code,
						title,
						slug,
						summary: truncate(content.summary?.vi ?? content.summary?.en, 500),
						description:
							content.objectives?.vi ?? content.objectives?.en ?? null,
						categoryId: null,
						ownerId,
						coverUrl: null,
						level: null,
						language: 'vi',
						semester: null,
						status: 'published',
						visibility: 'public',
						estimatedHours:
							typeof content.hours?.total_study_hours === 'number'
								? Math.min(9999, content.hours.total_study_hours)
								: null,
						enrollmentOpen: true,
						maxStudents: null,
						publishedAt: now,
						archivedAt: null,
						createdBy: null,
						deletedAt: null,
						catalogRef: graph.courseRef,
					}),
				);

				const outcomeName = new Map(graph.outcomes.map((o) => [o.key, o]));
				let lessonOrder = 0;
				for (const topic of graph.topics) {
					const outcomes = topic.outcomeKeys
						.map((key) => outcomeName.get(key))
						.filter((o) => o !== undefined)
						.map((o) => `${o.code}: ${o.name}`);
					const section = await manager.save(
						manager.create(CourseSection, {
							courseId: course.id,
							title: truncate(topic.title, 255) ?? `Chủ đề ${topic.index}`,
							description: outcomes.length
								? `Chuẩn đầu ra: ${outcomes.join('; ')}`
								: null,
							orderIndex: topic.index,
							isPublished: true,
							publishedAt: now,
							catalogKey: topic.key,
						}),
					);

					const skills = graph.skills.filter((s) => s.topicKey === topic.key);
					await manager.save(
						skills.map((skill) => {
							lessonOrder += 1;
							return manager.create(Lesson, {
								courseId: course.id,
								sectionId: section.id,
								title: truncate(skill.name, 255) ?? `Bài ${lessonOrder}`,
								slug: `${lessonOrder}-${slugify(skill.name)}`.slice(0, 280),
								summary: truncate(topic.title, 500),
								content: null,
								contentFormat: 'markdown',
								orderIndex: lessonOrder,
								estimatedMinutes: null,
								availableFrom: null,
								dueAt: null,
								isPublished: true,
								publishedAt: now,
								createdBy: null,
								deletedAt: null,
								catalogKey: skill.key,
							});
						}),
					);

					await manager.save(
						manager.create(Quiz, {
							courseId: course.id,
							lessonId: null,
							sectionId: section.id,
							title: truncate(`Bài tập: ${topic.title}`, 255)!,
							description:
								'Câu hỏi được AI tạo từ nội dung chủ đề ở lần làm bài đầu tiên.',
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
							createdBy: null,
							deletedAt: null,
							catalogKey: topic.key,
						}),
					);
				}

				this.logger.log(
					`Mở khoá học ${graph.courseRef}: ${graph.topics.length} chương, ${lessonOrder} bài`,
				);
				return course.id;
			});
		} catch (error) {
			// Một tiến trình khác vừa tạo cùng môn — dùng luôn bản đó.
			if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
				const existing = await this.findByRef(graph.courseRef);
				if (existing) return existing.id;
			}
			throw error;
		}
	}

	/**
	 * Chủ sở hữu của khoá mở từ Catalog: tài khoản trong `CATALOG_COURSE_OWNER_EMAIL`, mặc định là
	 * admin đang hoạt động được tạo sớm nhất.
	 */
	private async resolveOwnerId(): Promise<string> {
		const email = this.config.get<string>('CATALOG_COURSE_OWNER_EMAIL')?.trim();
		const owner = email
			? await this.users.findOne({ where: { email, deletedAt: IsNull() } })
			: await this.users.findOne({
					where: { role: 'admin', status: 'active', deletedAt: IsNull() },
					order: { createdAt: 'ASC' },
				});
		if (!owner) {
			throw new ServiceUnavailableException(
				'Chưa có tài khoản admin để làm chủ sở hữu khoá học từ Catalog.',
			);
		}
		return owner.id;
	}
}
