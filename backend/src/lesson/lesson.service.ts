import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	PayloadTooLargeException,
	UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { Course } from '../course/entities/course.entity';
import { CourseSection } from '../course/entities/course-section.entity';
import { CourseAccessService } from '../course/course-access.service';
import { Enrollment } from '../course/entities/enrollment.entity';
import { Quiz } from '../exercise/entities/quiz.entity';
import { Submission } from '../exercise/entities/submission.entity';
import { LESSON_MESSAGE } from './constants/lesson-message.constant';
import { Lesson } from './entities/lesson.entity';
import { LessonMaterial } from './entities/lesson-material.entity';
import { LessonProgress } from './entities/lesson-progress.entity';
import { buildPageMeta, toSkip } from '../common/utils/pagination.util';
import {
	ALLOWED_UPLOAD_MIME_TYPES,
	MISSING_FILE_MESSAGE,
	StorageService,
	UPLOAD_MIME_LABEL,
	UPLOAD_MIME_MAP,
} from '../storage/storage.service';
import {
	toLessonDetail,
	toLessonListItem,
	toLessonMaterialStats,
	toMaterialItem,
	toSectionDetail,
	toSectionListItem,
	toSlug,
} from './lesson.mapper';
import { LESSON_SORT_COLUMN } from './types/lesson.type';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import {
	DEFAULT_TAKE,
	type PageOrder,
} from '../common/dto/pagination-query.dto';
import type { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { EnrollmentStatus } from '../common/types';
import type { CreateLessonDto } from './dto/create-lesson.dto';
import type { CreateSectionDto } from './dto/create-section.dto';
import type { FindLessonsQueryDto } from './dto/find-lessons-query.dto';
import type { FindSectionsQueryDto } from './dto/find-sections-query.dto';
import type { ReorderDto } from './dto/reorder.dto';
import type { UpdateLessonDto } from './dto/update-lesson.dto';
import type { UpdateSectionDto } from './dto/update-section.dto';
import type { UploadMaterialDto } from './dto/upload-material.dto';
import type {
	LessonMaterialStats,
	MaterialAggregateRow,
} from './lesson.mapper';
import type {
	LessonDetail,
	MaterialItem,
	PaginatedLessons,
	PaginatedMaterials,
	PaginatedSections,
	SectionDetail,
	SectionListItem,
} from './types/lesson.type';

/**
 * Trạng thái ghi danh được coi là "đang học" ⇒ học viên còn quyền xem nội dung.
 *
 * `dropped`/`expired` **không** nằm trong đây: ghi danh đã kết thúc thì quyền xem nội dung cũng hết.
 */
const ACTIVE_ENROLLMENT_STATUS: EnrollmentStatus[] = ['active', 'completed'];

/** Số chương mặc định trả về của `GET /api/courses/:courseId/sections` — xem `findSections`. */
const SECTION_DEFAULT_TAKE = 100;

/** Thống kê rỗng cho bài chưa có học liệu (tránh tạo object mới ở mỗi vòng `map`). */
const EMPTY_MATERIAL_STATS: LessonMaterialStats = {
	derivedType: 'text',
	materialCount: 0,
};

/**
 * Hình dạng tệp multer gắn vào request.
 *
 * `@types/multer` **không** có trong `package.json` (task cấm thêm phụ thuộc) nên không thể dùng
 * `Express.Multer.File`. Interface này khai đúng bốn trường mà service thực sự đọc; nó **hẹp hơn**
 * type của thư viện nên mọi object multer thật đều khớp.
 */
export interface UploadedFileLike {
	originalname: string;
	mimetype: string;
	size: number;
	buffer: Buffer;
}

/**
 * Kết quả của `PATCH /api/lessons/:id/publish` và `.../hide`.
 *
 * Cố ý **không** trả `LessonDetail`: hai endpoint này là thao tác bật/tắt cờ, FE chỉ cần biết trạng
 * thái mới và mốc cập nhật (để vô hiệu hoá cache) — trả cả chi tiết bài học sẽ kéo theo truy vấn học
 * liệu không cần thiết cho một cú click.
 */
export interface LessonPublishState {
	id: string;
	isPublished: boolean;
	updatedAt: Date;
}

export interface LessonCompletionResult {
	lessonId: string;
	enrollmentId: string;
	state: 'completed' | 'not_started';
	completedAt: Date | null;
	progressPercent: number;
	createdLearningEventIds: string[];
}

/**
 * Nghiệp vụ chương/bài học/học liệu (E3-T2, E3-T4).
 *
 * **Một service cho cả ba nhóm endpoint** là quyết định có chủ đích: cả ba chia sẻ đúng một quy tắc
 * quyền — "bài học này có được xem không" — và quy tắc đó được dùng ở hai endpoint
 * (`GET /lessons/:id`, `GET /lessons/:id/materials`). Tách thành ba service sẽ buộc phải export chéo
 * quy tắc, và đúng lúc đó nó dễ bị chép lại rồi lệch.
 *
 * Mọi truy vấn lọc `deleted_at IS NULL` **tường minh**: `deleted_at` là cột thường (không phải
 * `@DeleteDateColumn`) nên TypeORM không tự thêm điều kiện — quên một chỗ là bản ghi đã xoá mềm
 * xuất hiện lại trong lộ trình.
 */
@Injectable()
export class LessonService {
	private readonly logger = new Logger(LessonService.name);

	constructor(
		@InjectRepository(CourseSection)
		private readonly sections: Repository<CourseSection>,
		@InjectRepository(Lesson)
		private readonly lessons: Repository<Lesson>,
		@InjectRepository(LessonMaterial)
		private readonly materials: Repository<LessonMaterial>,
		@InjectRepository(LessonProgress)
		private readonly lessonProgress: Repository<LessonProgress>,
		@InjectRepository(Quiz)
		private readonly quizzes: Repository<Quiz>,
		@InjectRepository(Enrollment)
		private readonly enrollments: Repository<Enrollment>,
		private readonly courseAccess: CourseAccessService,
		private readonly storage: StorageService,
		private readonly dataSource: DataSource,
	) {}

	// =========================================================================
	// Chương (sections)
	// =========================================================================

	/**
	 * `GET /api/courses/:courseId/sections` (E3-T2) — mọi vai trò đã đăng nhập.
	 *
	 * `assertCanView` là cổng duy nhất cho endpoint này (theo brief): giảng viên phụ trách thấy được
	 * chương của khoá `draft` để soạn nội dung. Hệ quả đã biết và có chủ đích: với khoá `published`,
	 * **mọi** vai trò đã đăng nhập đều đọc được khung chương — chương chỉ là tiêu đề điều hướng, còn
	 * nội dung bài học mới là thứ bị chặn. `assertLessonViewable` (dùng cho `GET /lessons/:id`) vì vậy
	 * chặt hơn hẳn: học viên phải đã ghi danh và bài phải đã công bố.
	 */
	async findSections(
		courseId: string,
		query: FindSectionsQueryDto,
		actor: AuthUser,
	): Promise<PaginatedSections> {
		await this.courseAccess.assertCanView(courseId, actor);

		const page = query.page;
		// `take = 20` là giá trị mặc định của `PaginationQueryDto`; không phân biệt được "client gửi
		// đúng 20" với "client không gửi" ở tầng DTO, nên dùng 20 như dấu hiệu "không gửi" và áp mặc
		// định 100 của riêng endpoint (client muốn đúng 20 vẫn có thể gửi `?take=20`, chấp nhận đánh
		// đổi nhỏ này để giữ một trần `MAX_TAKE` duy nhất).
		const take =
			query.take === DEFAULT_TAKE ? SECTION_DEFAULT_TAKE : query.take;

		const builder = this.sections
			.createQueryBuilder('section')
			.where('section.courseId = :courseId', { courseId })
			.orderBy('section.orderIndex', 'ASC')
			// Khoá phụ `id`: hai chương không thể trùng `order_index` (UNIQUE), nhưng giữ quy ước
			// "ORDER BY luôn có khoá phụ" để phân trang ổn định nếu ràng buộc đó đổi về sau.
			.addOrderBy('section.id', 'ASC')
			.skip(toSkip(page, take))
			.take(take);

		if (query.search) {
			// `LOWER(...) LIKE LOWER(:keyword)` thay vì `ILIKE`: cùng kết quả nhưng không phụ thuộc
			// cú pháp riêng của Postgres, đồng thời khớp cách `UserService` tìm kiếm ở E2.
			builder.andWhere('LOWER(section.title) LIKE :keyword', {
				keyword: `%${query.search.toLowerCase()}%`,
			});
		}

		const [rows, total] = await builder.getManyAndCount();

		// Một truy vấn gộp cho **cả trang**: N+1 (mỗi chương một `COUNT`) sẽ thành 100 truy vấn khi
		// FE kéo đủ chương của một khoá lớn.
		const counts = await this.countLessonsBySection(
			courseId,
			rows.map((row) => row.id),
		);

		return {
			items: rows.map((row) => toSectionListItem(row, counts.get(row.id) ?? 0)),
			meta: buildPageMeta(total, page, take),
		};
	}

	/** `POST /api/courses/:courseId/sections` (E3-T2) — chủ sở hữu/đồng giảng viên/admin. */
	async createSection(
		courseId: string,
		dto: CreateSectionDto,
		actor: AuthUser,
	): Promise<SectionListItem> {
		await this.courseAccess.assertCanManage(courseId, actor);

		const isPublished = dto.isPublished ?? false;

		const section = this.sections.create({
			courseId,
			title: dto.title,
			description: dto.description ?? null,
			// Thứ tự nối vào cuối: `MAX(order_index) + 1` thay vì `COUNT(*) + 1` để không sinh trùng khi
			// chương trước đó đã bị xoá cứng (chương không có soft delete).
			orderIndex: await this.nextSectionOrderIndex(courseId),
			isPublished,
			publishedAt: isPublished ? new Date() : null,
		});

		const saved = await this.sections.save(section);

		return toSectionListItem(saved, 0);
	}

	/**
	 * `GET /api/sections/:id` (E3-T2) — mọi vai trò đã đăng nhập, quyền xét theo khoá học chứa nó.
	 *
	 * Học viên chỉ thấy bài **đã công bố**: chương là khung điều hướng, để lộ tên bài chưa công bố là
	 * tiết lộ nội dung đang soạn, và FE sẽ dựng link dẫn tới bài mà `GET /lessons/:id` từ chối — mâu
	 * thuẫn khó hiểu cho người dùng.
	 */
	async findSectionById(
		sectionId: string,
		actor: AuthUser,
	): Promise<SectionDetail> {
		const section = await this.findSectionOrFail(sectionId);
		await this.courseAccess.assertCanView(section.courseId, actor);

		const canManage = await this.canManageCourse(section.courseId, actor);
		const lessons = await this.loadSectionLessons(section, canManage);
		const stats = await this.loadMaterialStats(
			lessons.map((lesson) => lesson.id),
		);

		// `lessonCount` là **tổng** số bài chưa xoá của chương (cùng định nghĩa với danh sách chương),
		// không phải số phần tử của `lessons`: `loadSectionLessons` có trần `SECTION_DEFAULT_TAKE`, nên
		// lấy `lessons.length` sẽ khiến một chương dài báo sai số bài và FE hiển thị "100 bài" cho
		// chương có 145 bài. Truy vấn này chạy gộp nên không tốn thêm round-trip đáng kể.
		const counts = await this.countLessonsBySection(section.courseId, [
			section.id,
		]);

		return toSectionDetail(
			section,
			counts.get(section.id) ?? lessons.length,
			lessons.map((lesson) =>
				toLessonListItem(lesson, stats.get(lesson.id) ?? EMPTY_MATERIAL_STATS),
			),
		);
	}

	/** `PATCH /api/sections/:id` (E3-T2) — chỉ ghi khoá client thực sự gửi. */
	async updateSection(
		sectionId: string,
		dto: UpdateSectionDto,
		actor: AuthUser,
	): Promise<SectionListItem> {
		const section = await this.findSectionOrFail(sectionId);
		await this.courseAccess.assertCanManage(section.courseId, actor);

		const changes: Partial<CourseSection> = {};

		if (dto.title !== undefined) changes.title = dto.title;
		if (dto.description !== undefined) changes.description = dto.description;

		if (dto.isPublished !== undefined) {
			changes.isPublished = dto.isPublished;
			// `published_at` là mốc **công bố lần đầu**, không phải "lần cập nhật cuối": bật lại chương
			// đã công bố không ghi đè mốc cũ, còn tắt thì phải xoá để lần bật sau ghi mốc mới (đối
			// xứng với `publish`/`hide` của bài học).
			if (dto.isPublished && !section.publishedAt) {
				changes.publishedAt = new Date();
			} else if (!dto.isPublished) {
				changes.publishedAt = null;
			}
		}

		if (Object.keys(changes).length > 0) {
			await this.sections.update({ id: sectionId }, changes);
		}

		const updated = await this.findSectionOrFail(sectionId);
		const counts = await this.countLessonsBySection(updated.courseId, [
			updated.id,
		]);

		return toSectionListItem(updated, counts.get(updated.id) ?? 0);
	}

	/**
	 * `DELETE /api/sections/:id` (E3-T2).
	 *
	 * **Chặn khi còn dấu vết học tập (E3-T2 DoD):** xoá chương sẽ `ON DELETE CASCADE` xoá luôn bài
	 * học, học liệu, quiz và — qua cascade của `lesson_progress`/`submissions` — toàn bộ tiến độ của
	 * học viên. Đó là mất dữ liệu học tập không lấy lại được, nên phải chặn ở đây thay vì tin vào
	 * cascade của DB.
	 */
	async deleteSection(
		sectionId: string,
		actor: AuthUser,
	): Promise<{ success: boolean }> {
		const section = await this.findSectionOrFail(sectionId);
		await this.courseAccess.assertCanManage(section.courseId, actor);

		const trail = await this.findLearningTrail(section.courseId, {
			sectionId,
		});

		if (trail.hasSubmission || trail.hasProgress) {
			throw new ConflictException(LESSON_MESSAGE.sectionHasSubmissions);
		}

		// Xoá cứng: chương không có soft delete, và các chương còn lại không cần đánh số lại (chương
		// không phải "bài kế tiếp" của lộ trình học — chỉ bài học mới cần liên tục).
		await this.sections.delete({ id: sectionId });

		// Trả `{ success: true }` chứ không phải `{ id }`: mọi endpoint DELETE khác của dự án
		// (`/courses/:id`, `/categories/:id`, `/cohorts/:id`) trả cùng hình dạng này và FE khai
		// `DefaultResponseType<{ success: boolean }>` cho tất cả. Sự lệch nhau chỉ vì hai module được
		// viết song song ở E3 — đồng nhất ngay khi phát hiện.
		return { success: true };
	}

	/**
	 * `PATCH /api/courses/:courseId/sections/reorder` (E3-T2).
	 *
	 * `UNIQUE (course_id, order_index)` khiến việc ghi trực tiếp từng dòng có thể vi phạm **tạm
	 * thời**: đổi chương 1 ↔ 2 thì lần ghi thứ nhất trùng với dòng chưa đổi. Vì vậy toàn bộ nằm trong
	 * **một transaction** và theo hai pha: đẩy hết về giá trị âm (không thể trùng với `order_index`
	 * hợp lệ vì cột không có ràng buộc `>= 1` ở DB), rồi ghi giá trị cuối. Không có pha âm thì
	 * transaction chết giữa đường và rollback — người dùng nhận lỗi 500 dù payload hợp lệ.
	 */
	async reorderSections(
		courseId: string,
		dto: ReorderDto,
		actor: AuthUser,
	): Promise<{ updated: number }> {
		await this.courseAccess.assertCanManage(courseId, actor);

		const sections = await this.sections.find({
			where: { courseId },
			order: { orderIndex: 'ASC' },
		});

		this.assertReorderMatches(
			dto.items.map((item) => item.id),
			sections.map((section) => section.id),
			dto.items.map((item) => item.orderIndex),
		);

		await this.dataSource.transaction(async (manager) => {
			await this.shiftSectionOrderToNegative(manager, courseId);

			for (const item of dto.items) {
				await manager.update(
					CourseSection,
					{ id: item.id, courseId },
					{ orderIndex: item.orderIndex },
				);
			}
		});

		return { updated: dto.items.length };
	}

	// =========================================================================
	// Bài học (lessons)
	// =========================================================================

	/**
	 * `GET /api/courses/:courseId/lessons` (E3-T2) — mọi vai trò đã đăng nhập.
	 *
	 * Học viên bị **ép** `is_published = true` bất kể query gửi gì: nếu tin tham số của client thì chỉ
	 * cần thêm `?isPublished=false` là đọc được danh sách bài đang soạn.
	 *
	 * Thứ tự mặc định là `orderIndex ASC` (xem `LESSON_DEFAULT_ORDER`): đây là **lộ trình**, không
	 * phải bảng quản trị sắp theo thời gian tạo.
	 */
	async findLessons(
		courseId: string,
		query: FindLessonsQueryDto,
		actor: AuthUser,
	): Promise<PaginatedLessons> {
		const course = await this.courseAccess.assertCanView(courseId, actor);

		const builder = this.lessons
			.createQueryBuilder('lesson')
			.where('lesson.courseId = :courseId', { courseId })
			.andWhere('lesson.deletedAt IS NULL');

		if (query.sectionId) {
			builder.andWhere('lesson.sectionId = :sectionId', {
				sectionId: query.sectionId,
			});
		}

		// Điều kiện viết dạng "không phải teacher/admin" (thay vì `=== 'student'`) để **fail closed**:
		// nếu một vai trò mới được thêm vào `UserRole` mà quên cập nhật ở đây, vai trò đó bị đối xử như
		// học viên (chỉ thấy bài đã công bố) chứ không tự động thấy toàn bộ nội dung đang soạn.
		if (actor.role !== 'teacher' && actor.role !== 'admin') {
			// Lọc ở tầng SQL chứ không lọc sau khi phân trang: lọc sau sẽ cho ra trang thiếu bản ghi
			// (và `meta.itemCount` sai) khi khoá học có lẫn bài chưa công bố.
			builder.andWhere('lesson.isPublished = true');

			if (!this.canStudentViewCourse(course)) {
				// Học viên chỉ xem được khoá `published` và không `private`. Dùng **cùng** điều kiện
				// với `assertLessonViewable` để danh sách và chi tiết không bao giờ bất đồng.
				throw new ForbiddenException(LESSON_MESSAGE.notAccessible);
			}
		} else if (query.isPublished !== undefined) {
			builder.andWhere('lesson.isPublished = :isPublished', {
				isPublished: query.isPublished,
			});
		}

		const [rows, total] = await builder
			.orderBy(LESSON_SORT_COLUMN[query.sortBy], this.toSqlOrder(query.order))
			.addOrderBy('lesson.id', 'ASC')
			.skip(toSkip(query.page, query.take))
			.take(query.take)
			.getManyAndCount();

		const stats = await this.loadMaterialStats(rows.map((row) => row.id));

		return {
			items: rows.map((row) =>
				toLessonListItem(row, stats.get(row.id) ?? EMPTY_MATERIAL_STATS),
			),
			meta: buildPageMeta(total, query.page, query.take),
		};
	}

	/** `POST /api/sections/:sectionId/lessons` (E3-T2). */
	async createLesson(
		sectionId: string,
		dto: CreateLessonDto,
		actor: AuthUser,
	): Promise<LessonDetail> {
		const section = await this.findSectionOrFail(sectionId);
		const course = await this.courseAccess.assertCanManage(
			section.courseId,
			actor,
		);

		const isPublished = dto.isPublished ?? false;

		// Thứ tự là **toàn khoá học**, không phải trong chương: `uq_lessons_course_order` ràng buộc
		// theo `course_id`, nên đánh số từ 1 trong mỗi chương sẽ vi phạm khoá duy nhất ngay bài đầu
		// tiên của chương thứ hai.
		const orderIndex = await this.nextLessonOrderIndex(course.id);
		const slug = await this.generateUniqueSlug(dto.title, course.id);

		const lesson = this.lessons.create({
			courseId: course.id,
			sectionId,
			title: dto.title,
			slug,
			summary: dto.summary ?? null,
			content: dto.content ?? null,
			contentFormat: dto.contentFormat ?? 'html',
			orderIndex,
			estimatedMinutes: dto.estimatedMinutes ?? null,
			availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
			dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
			isPublished,
			publishedAt: isPublished ? new Date() : null,
			createdBy: actor.id,
		});

		const saved = await this.lessons.save(lesson);

		return this.buildLessonDetail(saved, section);
	}

	/**
	 * `GET /api/lessons/:id` (E3-T2) — **quy tắc hiển thị là DoD được chấm điểm**.
	 *
	 * - `admin`: luôn xem được (kể cả bài chưa công bố của khoá `draft`) — cần cho kiểm duyệt.
	 * - `teacher`: chỉ khi phụ trách khoá học (chủ sở hữu hoặc có dòng `course_instructors`), ngược
	 *   lại `403`. Không dùng `assertCanView` ở đây vì nó cho qua mọi khoá `published` — giảng viên
	 *   không phụ trách sẽ đọc được bài của đồng nghiệp.
	 * - `student`: cần **đủ ba** điều kiện (khoá `published` + không `private`; bài đã công bố; có ghi
	 *   danh `active`/`completed`). Thiếu bất kỳ điều kiện nào là `403`, không phải `404` — theo ma
	 *   trận RBAC §6 và để FE phân biệt "không có quyền" với "gõ sai ID".
	 */
	async findLessonById(id: string, actor: AuthUser): Promise<LessonDetail> {
		const lesson = await this.findLessonOrFail(id);
		const section = await this.findSectionOrFail(lesson.sectionId);
		const course = await this.courseAccess.findCourseOrFail(lesson.courseId);

		await this.assertLessonViewable(lesson, course, actor);

		return this.buildLessonDetail(lesson, section);
	}

	async completeLesson(
		id: string,
		timeSpentSeconds: number,
		actor: AuthUser,
	): Promise<LessonCompletionResult> {
		const lesson = await this.findLessonOrFail(id);
		const course = await this.courseAccess.findCourseOrFail(lesson.courseId);
		await this.assertLessonViewable(lesson, course, actor);
		const enrollment = await this.enrollments.findOne({
			where: {
				userId: actor.id,
				courseId: lesson.courseId,
				status: In(ACTIVE_ENROLLMENT_STATUS),
			},
		});
		if (!enrollment) {
			throw new ForbiddenException('Bạn chưa ghi danh khoá học này.');
		}

		const now = new Date();
		let saved = await this.lessonProgress.findOne({
			where: { enrollmentId: enrollment.id, lessonId: lesson.id },
		});
		if (saved?.status !== 'completed') {
			await this.lessonProgress.upsert(
				{
					enrollmentId: enrollment.id,
					userId: actor.id,
					courseId: lesson.courseId,
					lessonId: lesson.id,
					status: 'completed',
					firstViewedAt: saved?.firstViewedAt ?? now,
					lastViewedAt: now,
					completedAt: now,
					timeSpentSeconds: (saved?.timeSpentSeconds ?? 0) + timeSpentSeconds,
					lastPositionSeconds: null,
					viewCount: saved?.viewCount ?? 1,
				},
				['enrollmentId', 'lessonId'],
			);
			saved = await this.lessonProgress.findOne({
				where: { enrollmentId: enrollment.id, lessonId: lesson.id },
			});
		}
		const progress = await this.refreshEnrollmentProgress(enrollment);

		return {
			lessonId: lesson.id,
			enrollmentId: enrollment.id,
			state: 'completed',
			completedAt: saved?.completedAt ?? now,
			progressPercent: progress,
			createdLearningEventIds: [],
		};
	}

	async uncompleteLesson(
		id: string,
		actor: AuthUser,
	): Promise<LessonCompletionResult> {
		const lesson = await this.findLessonOrFail(id);
		const course = await this.courseAccess.findCourseOrFail(lesson.courseId);
		await this.assertLessonViewable(lesson, course, actor);
		const enrollment = await this.enrollments.findOne({
			where: {
				userId: actor.id,
				courseId: lesson.courseId,
				status: In(ACTIVE_ENROLLMENT_STATUS),
			},
		});
		if (!enrollment) {
			throw new ForbiddenException('Bạn chưa ghi danh khoá học này.');
		}

		const progress = await this.lessonProgress.findOne({
			where: { enrollmentId: enrollment.id, lessonId: lesson.id },
		});
		if (progress) {
			progress.status = 'not_started';
			progress.completedAt = null;
			await this.lessonProgress.save(progress);
		}
		const progressPercent = await this.refreshEnrollmentProgress(enrollment);

		return {
			lessonId: lesson.id,
			enrollmentId: enrollment.id,
			state: 'not_started',
			completedAt: null,
			progressPercent,
			createdLearningEventIds: [],
		};
	}

	private async refreshEnrollmentProgress(
		enrollment: Enrollment,
	): Promise<number> {
		const totalLessons = await this.lessons.count({
			where: {
				courseId: enrollment.courseId,
				isPublished: true,
				deletedAt: IsNull(),
			},
		});
		const completedLessons = await this.lessonProgress
			.createQueryBuilder('progress')
			.innerJoin(
				Lesson,
				'lesson',
				'lesson.id = progress.lesson_id AND lesson.is_published = true AND lesson.deleted_at IS NULL',
			)
			.where('progress.enrollmentId = :enrollmentId', {
				enrollmentId: enrollment.id,
			})
			.andWhere('progress.status = :status', { status: 'completed' })
			.getCount();
		const progressPercent = totalLessons
			? Math.round((completedLessons / totalLessons) * 10000) / 100
			: 0;
		enrollment.progressPercent = progressPercent;
		if (totalLessons > 0 && completedLessons === totalLessons) {
			enrollment.status = 'completed';
			enrollment.completedAt ??= new Date();
		} else {
			enrollment.status = 'active';
			enrollment.completedAt = null;
		}
		enrollment.lastActivityAt = new Date();
		await this.enrollments.save(enrollment);
		return progressPercent;
	}

	/** `PATCH /api/lessons/:id` (E3-T2) — chỉ ghi khoá client thực sự gửi. */
	async updateLesson(
		id: string,
		dto: UpdateLessonDto,
		actor: AuthUser,
	): Promise<LessonDetail> {
		const lesson = await this.findLessonOrFail(id);
		const course = await this.courseAccess.assertCanManage(
			lesson.courseId,
			actor,
		);

		const changes: Partial<Lesson> = {};

		if (dto.sectionId !== undefined && dto.sectionId !== lesson.sectionId) {
			const target = await this.findSectionOrFail(dto.sectionId);

			if (target.courseId !== course.id) {
				// Di chuyển sang khoá khác sẽ kéo theo quiz, tiến độ và ghi danh — ngoài phạm vi E3-T2.
				throw new BadRequestException(
					'Chỉ có thể chuyển bài học sang chương khác trong cùng khoá học.',
				);
			}

			changes.sectionId = target.id;
		}

		if (dto.title !== undefined) {
			changes.title = dto.title;
			// Slug chỉ sinh lại khi tiêu đề **thực sự** đổi. DTO không nhận `slug` từ client (slug sinh
			// từ tiêu đề) nên không có nhánh "client tự gửi slug"; nếu sau này bổ sung, điều kiện
			// `'slug' in dto` dưới đây là chỗ chặn việc ghi đè.
			if (dto.title !== lesson.title) {
				changes.slug = await this.generateUniqueSlug(dto.title, course.id, id);
			}
		}

		if (dto.summary !== undefined) changes.summary = dto.summary;
		if (dto.content !== undefined) changes.content = dto.content;
		if (dto.contentFormat !== undefined) {
			changes.contentFormat = dto.contentFormat;
		}
		if (dto.estimatedMinutes !== undefined) {
			changes.estimatedMinutes = dto.estimatedMinutes;
		}
		if (dto.availableFrom !== undefined) {
			changes.availableFrom = dto.availableFrom
				? new Date(dto.availableFrom)
				: null;
		}
		if (dto.dueAt !== undefined) {
			changes.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
		}

		if (dto.isPublished !== undefined) {
			changes.isPublished = dto.isPublished;
			if (dto.isPublished && !lesson.publishedAt) {
				changes.publishedAt = new Date();
			} else if (!dto.isPublished) {
				changes.publishedAt = null;
			}
		}

		if (Object.keys(changes).length > 0) {
			await this.lessons.update({ id }, changes);
		}

		const updated = await this.findLessonOrFail(id);
		const section = await this.findSectionOrFail(updated.sectionId);

		return this.buildLessonDetail(updated, section);
	}

	/**
	 * `DELETE /api/lessons/:id` (E3-T2) — xoá **mềm** + đánh số lại lộ trình.
	 *
	 * Hai lý do cho từng bước:
	 * 1. **Chặn trước khi xoá:** bài đã có bài làm/tiến độ thì xoá là mất dữ liệu analytics — đúng DoD
	 *    "bảo vệ dữ liệu phân tích" của E3-T2.
	 * 2. **Đánh số lại trong cùng transaction:** `order_index` là lộ trình; để lại lỗ hổng (1, 3, 4)
	 *    làm "bài kế tiếp" của FE nhảy cóc. Không thể chỉ trừ 1 cho các bài sau vì `order_index` có
	 *    UNIQUE (partial) — phải đẩy tạm về âm rồi ghi lại.
	 */
	async deleteLesson(
		id: string,
		actor: AuthUser,
	): Promise<{ success: boolean }> {
		const lesson = await this.findLessonOrFail(id);
		await this.courseAccess.assertCanManage(lesson.courseId, actor);

		const trail = await this.findLearningTrail(lesson.courseId, { id });

		if (trail.hasSubmission || trail.hasProgress) {
			throw new ConflictException(LESSON_MESSAGE.lessonHasSubmissions);
		}

		await this.dataSource.transaction(async (manager) => {
			await manager.update(
				Lesson,
				{ id },
				{ deletedAt: new Date(), isPublished: false, publishedAt: null },
			);

			// Chỉ đánh số lại các bài **chưa xoá** của khoá: bài vừa xoá mềm đã ra khỏi partial index
			// nên không còn tranh chỗ với dãy mới.
			const remaining = await manager.find(Lesson, {
				where: { courseId: lesson.courseId, deletedAt: IsNull() },
				order: { orderIndex: 'ASC' },
			});

			await this.renumberLessons(manager, lesson.courseId, remaining);
		});

		// Cùng hình dạng với mọi DELETE khác của dự án — xem ghi chú ở `deleteSection`.
		return { success: true };
	}

	/**
	 * `PATCH /api/sections/:sectionId/lessons/reorder` (E3-T2).
	 *
	 * **Vì sao không đánh số 1..n trong phạm vi chương:** `uq_lessons_course_order` là UNIQUE theo
	 * `course_id`, nên thứ tự phải liên tục trên **toàn khoá học**. Payload chỉ nói thứ tự mong muốn
	 * của các bài **trong chương**; service lấy đúng các vị trí mà chúng đang chiếm trong khoá (giữ
	 * nguyên vị trí của bài thuộc chương khác) rồi xếp lại theo yêu cầu — nhờ đó thao tác trên một
	 * chương không xáo trộn lộ trình của các chương còn lại.
	 */
	async reorderSectionLessons(
		sectionId: string,
		dto: ReorderDto,
		actor: AuthUser,
	): Promise<{ updated: number }> {
		const section = await this.findSectionOrFail(sectionId);
		await this.courseAccess.assertCanManage(section.courseId, actor);

		const courseLessons = await this.lessons.find({
			where: { courseId: section.courseId, deletedAt: IsNull() },
			order: { orderIndex: 'ASC' },
		});

		const sectionLessonIds = courseLessons
			.filter((lesson) => lesson.sectionId === sectionId)
			.map((lesson) => lesson.id);

		this.assertReorderMatches(
			dto.items.map((item) => item.id),
			sectionLessonIds,
			dto.items.map((item) => item.orderIndex),
		);

		// Vị trí (index trong dãy đã sắp theo `order_index`) mà các bài của chương này đang chiếm
		// trong toàn khoá.
		const slots: number[] = [];
		courseLessons.forEach((lesson, index) => {
			if (lesson.sectionId === sectionId) slots.push(index);
		});

		// `dto.items` đã được kiểm tra "đúng và đủ"; sắp theo `orderIndex` để con số client gửi quyết
		// định thứ tự bài trong chương.
		const requested = [...dto.items].sort(
			(a, b) => a.orderIndex - b.orderIndex,
		);
		const lessonById = new Map(
			courseLessons.map((lesson) => [lesson.id, lesson]),
		);
		const reordered = requested
			.map((item) => lessonById.get(item.id))
			.filter((lesson): lesson is Lesson => lesson !== undefined);

		const finalOrder = [...courseLessons];

		slots.forEach((slot, index) => {
			finalOrder[slot] = reordered[index];
		});

		await this.dataSource.transaction(async (manager) => {
			await this.shiftLessonOrderToNegative(manager, section.courseId);
			await this.renumberLessons(manager, section.courseId, finalOrder);
		});

		return { updated: dto.items.length };
	}

	/** `PATCH /api/lessons/:id/publish` (E3-T2). */
	async publishLesson(
		id: string,
		actor: AuthUser,
	): Promise<LessonPublishState> {
		return this.setLessonPublished(id, true, actor);
	}

	/** `PATCH /api/lessons/:id/hide` (E3-T2). */
	async hideLesson(id: string, actor: AuthUser): Promise<LessonPublishState> {
		return this.setLessonPublished(id, false, actor);
	}

	// =========================================================================
	// Học liệu (materials) — E3-T4
	// =========================================================================

	/**
	 * `POST /api/lessons/:id/materials` (E3-T4).
	 *
	 * **Thứ tự kiểm tra là một phần của hợp đồng**, đúng như brief:
	 * `400` (không có tệp) → `415` (MIME ngoài whitelist) → `413` (quá dung lượng) → ghi đĩa → ghi DB.
	 * Kiểm tra MIME **trước** dung lượng để một tệp `.exe` 100 MB nhận đúng thông báo "định dạng không
	 * hỗ trợ" thay vì "quá lớn" (thông báo thứ hai khiến người dùng tưởng chỉ cần nén nhỏ lại).
	 */
	async createMaterial(
		lessonId: string,
		file: UploadedFileLike | undefined,
		dto: UploadMaterialDto,
		actor: AuthUser,
	): Promise<MaterialItem> {
		const lesson = await this.findLessonOrFail(lessonId);
		await this.courseAccess.assertCanManage(lesson.courseId, actor);

		if (!file?.buffer) {
			throw new BadRequestException(MISSING_FILE_MESSAGE);
		}

		const mapping = UPLOAD_MIME_MAP[file.mimetype];

		if (!mapping) {
			throw new UnsupportedMediaTypeException(
				`Định dạng tệp không được hỗ trợ. Chỉ nhận: ${this.describeAllowedMimeTypes()}.`,
			);
		}

		if (file.size > this.storage.maxSizeBytes) {
			throw new PayloadTooLargeException(
				`Tệp vượt quá dung lượng cho phép (tối đa ${this.storage.maxSizeMb} MB).`,
			);
		}

		// Ghi tệp trước, ghi DB sau: nếu bước DB lỗi thì chỉ còn một tệp mồ côi (dọn bằng tay hoặc bỏ
		// qua), trong khi thứ tự ngược lại để lại hàng DB trỏ tới tệp không tồn tại — FE hiển thị học
		// liệu hỏng mà không có cách nào tự phát hiện.
		const saved = await this.storage.saveBuffer({
			folder: `lessons/${lessonId}`,
			originalName: file.originalname,
			buffer: file.buffer,
			mimeType: file.mimetype,
		});

		try {
			const material = await this.materials.save(
				this.materials.create({
					lessonId,
					materialType: mapping.materialType,
					// Tiêu đề lấy từ form; tên tệp gốc chỉ là phương án dự phòng **hiển thị** (nó không
					// đi vào đường dẫn tệp — xem `StorageService.saveBuffer`).
					title: dto.title?.trim() || file.originalname.slice(0, 255),
					content: null,
					url: saved.fileUrl,
					storageKey: saved.storageKey,
					mimeType: file.mimetype,
					fileSizeBytes: file.size,
					durationSeconds: null,
					orderIndex: await this.nextMaterialOrderIndex(lessonId),
					isPublished: true,
				}),
			);

			return toMaterialItem(material);
		} catch (error) {
			// Bù trừ: hàng DB không được tạo thì tệp vừa ghi là rác. Ghi log vì đây là lỗi hiếm (DB lỗi
			// sau khi tệp đã ghi) và người vận hành cần biết có tệp mồ côi trong `UPLOAD_DIR`.
			this.logger.error(
				`Không tạo được học liệu cho bài ${lessonId}, đã xoá tệp ${saved.storageKey}`,
			);
			await this.storage.remove(saved.storageKey);
			throw error;
		}
	}

	/**
	 * `GET /api/lessons/:id/materials` (E3-T4).
	 *
	 * Dùng **đúng** `assertLessonViewable` như `GET /api/lessons/:id` — không chép lại quy tắc, vì đây
	 * là chỗ dễ lệch nhất: học liệu thường chứa chính nội dung mà bài học đang giấu.
	 */
	async findMaterials(
		lessonId: string,
		query: PaginationQueryDto,
		actor: AuthUser,
	): Promise<PaginatedMaterials> {
		const lesson = await this.findLessonOrFail(lessonId);
		const course = await this.courseAccess.findCourseOrFail(lesson.courseId);

		await this.assertLessonViewable(lesson, course, actor);

		const [rows, total] = await this.materials.findAndCount({
			where: { lessonId },
			order: { orderIndex: 'ASC', createdAt: 'ASC' },
			skip: toSkip(query.page, query.take),
			take: query.take,
		});

		return {
			items: rows.map(toMaterialItem),
			meta: buildPageMeta(total, query.page, query.take),
		};
	}

	/**
	 * `DELETE /api/materials/:id` (E3-T4).
	 *
	 * Xoá hàng DB trước rồi xoá tệp **best-effort**: hàng DB là nguồn chân lý, tệp mồ côi chỉ tốn đĩa.
	 * Nếu để lỗi xoá tệp làm hỏng request thì người dùng thấy "xoá thất bại" trong khi hàng đã biến
	 * mất — trạng thái nửa vời khó dọn hơn nhiều so với một tệp thừa.
	 */
	async deleteMaterial(
		id: string,
		actor: AuthUser,
	): Promise<{ success: boolean }> {
		const material = await this.materials.findOne({ where: { id } });

		if (!material) {
			throw new NotFoundException(LESSON_MESSAGE.materialNotFound(id));
		}

		const lesson = await this.findLessonOrFail(material.lessonId);
		await this.courseAccess.assertCanManage(lesson.courseId, actor);

		await this.materials.delete({ id });

		if (material.storageKey) {
			await this.storage.remove(material.storageKey);
		}

		// Cùng hình dạng với mọi DELETE khác của dự án — xem ghi chú ở `deleteSection`.
		return { success: true };
	}

	// =========================================================================
	// Quy tắc quyền — một nguồn chân lý
	// =========================================================================

	/**
	 * Quy tắc hiển thị của `GET /api/lessons/:id` **và** `GET /api/lessons/:id/materials`.
	 *
	 * Là **một** private method vì brief yêu cầu rõ hai endpoint phải dùng chung quy tắc: nếu để hai
	 * bản, sửa một bản (ví dụ thêm điều kiện ghi danh) là học liệu lộ nội dung mà bài học đã chặn.
	 */
	private async assertLessonViewable(
		lesson: Lesson,
		course: Course,
		actor: AuthUser,
	): Promise<void> {
		if (actor.role === 'admin') return;

		if (actor.role === 'teacher') {
			if (await this.courseAccess.canManage(course, actor)) return;

			throw new ForbiddenException(LESSON_MESSAGE.notAccessible);
		}

		// Học viên: phải đủ ba điều kiện.
		if (!this.canStudentViewCourse(course)) {
			throw new ForbiddenException(LESSON_MESSAGE.notAccessible);
		}

		if (!lesson.isPublished || lesson.deletedAt) {
			throw new ForbiddenException(LESSON_MESSAGE.notAccessible);
		}

		const enrolled = await this.enrollments.count({
			where: {
				userId: actor.id,
				courseId: course.id,
				// `dropped`/`expired` bị chặn: ghi danh đã kết thúc thì quyền xem nội dung cũng hết.
				status: In(ACTIVE_ENROLLMENT_STATUS),
			},
		});

		if (enrolled === 0) {
			throw new ForbiddenException(LESSON_MESSAGE.notAccessible);
		}
	}

	/** Khoá học phải đã công bố và không riêng tư — điều kiện đầu của quy tắc dành cho học viên. */
	private canStudentViewCourse(course: Course): boolean {
		return course.status === 'published' && course.visibility !== 'private';
	}

	/** `true` nếu actor được sửa nội dung khoá học (chủ sở hữu/đồng giảng viên/admin). */
	private async canManageCourse(
		courseId: string,
		actor: AuthUser,
	): Promise<boolean> {
		if (actor.role === 'admin') return true;
		if (actor.role !== 'teacher') return false;

		const course = await this.courseAccess.findCourseOrFail(courseId);

		return this.courseAccess.canManage(course, actor);
	}

	// =========================================================================
	// Truy vấn dùng chung
	// =========================================================================

	/** Chương theo id; bảng chương không có soft delete nên chỉ cần tồn tại. */
	private async findSectionOrFail(id: string): Promise<CourseSection> {
		const section = await this.sections.findOne({ where: { id } });

		if (!section) {
			throw new NotFoundException(LESSON_MESSAGE.sectionNotFound(id));
		}

		return section;
	}

	private async findLessonOrFail(id: string): Promise<Lesson> {
		const lesson = await this.lessons.findOne({
			where: { id, deletedAt: IsNull() },
		});

		if (!lesson) {
			throw new NotFoundException(LESSON_MESSAGE.lessonNotFound(id));
		}

		return lesson;
	}

	/**
	 * `COUNT(lessons)` theo chương trong **một** truy vấn cho cả trang.
	 *
	 * `getRawMany` dùng alias không khớp thuộc tính entity nào (`sectionId`, `lessonCount`) nên phải
	 * khai kiểu generic tường minh: nếu để TypeORM suy luận, kết quả là `any[]` và ESLint
	 * `no-unsafe-*` sẽ chặn (đúng tinh thần — dữ liệu thô từ DB phải được đặt kiểu trước khi dùng).
	 */
	private async countLessonsBySection(
		courseId: string,
		sectionIds: string[],
	): Promise<Map<string, number>> {
		const counts = new Map<string, number>();

		if (sectionIds.length === 0) return counts;

		const rows = await this.lessons
			.createQueryBuilder('lesson')
			.select('lesson.sectionId', 'sectionId')
			.addSelect('COUNT(lesson.id)', 'lessonCount')
			.where('lesson.courseId = :courseId', { courseId })
			.andWhere('lesson.deletedAt IS NULL')
			.andWhere('lesson.sectionId IN (:...sectionIds)', { sectionIds })
			.groupBy('lesson.sectionId')
			.getRawMany<{ sectionId: string; lessonCount: string }>();

		for (const row of rows) {
			// `COUNT(*)` trả `bigint` ⇒ driver `pg` đưa về **string**, phải ép số trước khi trả ra
			// (cùng cái bẫy đã ghi ở `LessonMaterial.fileSizeBytes`, §8.7 của database-design).
			counts.set(row.sectionId, Number(row.lessonCount));
		}

		return counts;
	}

	/**
	 * `materialCount` + `derivedType` cho nhiều bài trong **một** truy vấn.
	 *
	 * Đây là chỗ hiện thực hoá quyết định "database-design thắng": `lessons` không có cột
	 * `type`/`video_url`/`duration_seconds`, nên loại bài học phải suy ra từ
	 * `lesson_materials.material_type`.
	 */
	private async loadMaterialStats(
		lessonIds: string[],
	): Promise<Map<string, LessonMaterialStats>> {
		if (lessonIds.length === 0) return new Map();

		const rows = await this.materials
			.createQueryBuilder('material')
			.select('material.lessonId', 'lessonId')
			.addSelect('material.materialType', 'materialType')
			.addSelect('COUNT(material.id)', 'materialCount')
			.where('material.lessonId IN (:...lessonIds)', { lessonIds })
			.groupBy('material.lessonId')
			.addGroupBy('material.materialType')
			.getRawMany<MaterialAggregateRow>();

		return toLessonMaterialStats(rows);
	}

	/**
	 * Bài học của một chương, kèm bộ lọc theo vai trò.
	 *
	 * Giới hạn `SECTION_DEFAULT_TAKE` bài mỗi lần gọi chương: `GET /api/sections/:id` không có tham số
	 * phân trang (theo brief), nên trần này chặn một chương bất thường có hàng nghìn bài kéo sập
	 * response. FE muốn xem đủ thì dùng `GET /api/courses/:courseId/lessons?sectionId=...`.
	 */
	private async loadSectionLessons(
		section: CourseSection,
		includeUnpublished: boolean,
	): Promise<Lesson[]> {
		const builder = this.lessons
			.createQueryBuilder('lesson')
			.where('lesson.sectionId = :sectionId', { sectionId: section.id })
			.andWhere('lesson.deletedAt IS NULL')
			// Thứ tự `orderIndex ASC`: chương là một đoạn của lộ trình, đọc từ trên xuống.
			.orderBy('lesson.orderIndex', 'ASC')
			.addOrderBy('lesson.id', 'ASC')
			.take(SECTION_DEFAULT_TAKE);

		if (!includeUnpublished) {
			builder.andWhere('lesson.isPublished = true');
		}

		return builder.getMany();
	}

	/**
	 * Dấu vết học tập còn lại của một chương hoặc một bài học (dùng để chặn xoá).
	 *
	 * `EXISTS` (qua `limit(1)`) thay vì `COUNT`: Postgres dừng ngay bản ghi đầu tiên, còn `COUNT` phải
	 * quét hết — `submissions` là bảng lớn nhất trong các job analytics.
	 */
	private async findLearningTrail(
		courseId: string,
		scope: { sectionId: string } | { id: string },
	): Promise<{ hasSubmission: boolean; hasProgress: boolean }> {
		const isLessonScope = 'id' in scope;
		const condition = isLessonScope
			? 'lesson.id = :scopeId'
			: 'lesson.sectionId = :scopeId';
		const params = {
			courseId,
			scopeId: isLessonScope ? scope.id : scope.sectionId,
		};

		const submissionRow = await this.quizzes
			.createQueryBuilder('quiz')
			.innerJoin(Lesson, 'lesson', 'lesson.id = quiz.lessonId')
			.innerJoin(Submission, 'submission', 'submission.quizId = quiz.id')
			.where('quiz.courseId = :courseId', { courseId })
			.andWhere('quiz.deletedAt IS NULL')
			// `params` phải truyền ở **cả hai** điều kiện dùng `:scopeId`: TypeORM không nhớ tham số
			// của lần `andWhere` trước, thiếu ở đây là lỗi runtime "No value provided for parameter".
			.andWhere(condition, params)
			.select('1', 'found')
			.limit(1)
			.getRawOne<{ found: number }>();

		const progressRow = await this.lessonProgress
			.createQueryBuilder('progress')
			.innerJoin(Lesson, 'lesson', 'lesson.id = progress.lessonId')
			.where('progress.courseId = :courseId', { courseId })
			.andWhere(condition, params)
			.select('1', 'found')
			.limit(1)
			.getRawOne<{ found: number }>();

		return {
			hasSubmission: submissionRow !== undefined,
			hasProgress: progressRow !== undefined,
		};
	}

	/** `MAX(order_index) + 1` trong phạm vi một khoá học. */
	private async nextSectionOrderIndex(courseId: string): Promise<number> {
		const row = await this.sections
			.createQueryBuilder('section')
			.select('MAX(section.orderIndex)', 'maxOrder')
			.where('section.courseId = :courseId', { courseId })
			.getRawOne<{ maxOrder: number | null }>();

		return Number(row?.maxOrder ?? 0) + 1;
	}

	/** `MAX(order_index) + 1` trên các bài **chưa xoá mềm** của khoá học. */
	private async nextLessonOrderIndex(courseId: string): Promise<number> {
		const row = await this.lessons
			.createQueryBuilder('lesson')
			.select('MAX(lesson.orderIndex)', 'maxOrder')
			.where('lesson.courseId = :courseId', { courseId })
			.andWhere('lesson.deletedAt IS NULL')
			.getRawOne<{ maxOrder: number | null }>();

		return Number(row?.maxOrder ?? 0) + 1;
	}

	/** `MAX(order_index) + 1` trong phạm vi một bài học. */
	private async nextMaterialOrderIndex(lessonId: string): Promise<number> {
		const row = await this.materials
			.createQueryBuilder('material')
			.select('MAX(material.orderIndex)', 'maxOrder')
			.where('material.lessonId = :lessonId', { lessonId })
			.getRawOne<{ maxOrder: number | null }>();

		return Number(row?.maxOrder ?? 0) + 1;
	}

	/**
	 * Sinh slug duy nhất **trong một khoá học** theo `uq_lessons_course_slug`.
	 *
	 * `excludeId` để `PATCH` không tự coi slug hiện tại của chính bài đó là trùng. Giới hạn 500 lần
	 * thử: `while (true)` trên bảng lớn có thể quay vô hạn nếu dữ liệu bất thường, còn 500 bài cùng
	 * tiêu đề trong một khoá là tình huống không có thật.
	 */
	private async generateUniqueSlug(
		title: string,
		courseId: string,
		excludeId?: string,
	): Promise<string> {
		const base = toSlug(title) || 'bai-hoc';

		for (let attempt = 1; attempt <= 500; attempt += 1) {
			const candidate =
				attempt === 1 ? base : this.withSlugSuffix(base, attempt);

			const existing = await this.lessons
				.createQueryBuilder('lesson')
				.where('lesson.courseId = :courseId', { courseId })
				.andWhere('lesson.slug = :slug', { slug: candidate })
				.andWhere(excludeId ? 'lesson.id <> :excludeId' : '1 = 1', {
					excludeId,
				})
				.getOne();

			if (!existing) return candidate;
		}

		// Không thể xảy ra với dữ liệu thật; ném lỗi thay vì trả slug trùng (sẽ vỡ UNIQUE ở tầng DB
		// với thông báo khó hiểu cho người dùng).
		throw new ConflictException(
			'Không thể tạo đường dẫn (slug) duy nhất cho bài học này.',
		);
	}

	/** Cắt `base` để `base-suffix` không vượt 280 ký tự (độ dài cột `lessons.slug`). */
	private withSlugSuffix(base: string, suffix: number): string {
		const tail = `-${suffix}`;

		return `${base.slice(0, 280 - tail.length)}${tail}`;
	}

	/**
	 * Kiểm tra payload sắp xếp: đúng và đủ tập bản ghi, không trùng id, `orderIndex` là dãy 1..n.
	 *
	 * Mỗi điều kiện có thông báo riêng để FE chỉ đúng chỗ sai — một câu chung "payload không hợp lệ"
	 * khiến người gọi không biết mình thiếu mục nào.
	 */
	private assertReorderMatches(
		payloadIds: string[],
		expectedIds: string[],
		orderIndexes: number[],
	): void {
		if (new Set(payloadIds).size !== payloadIds.length) {
			throw new BadRequestException(LESSON_MESSAGE.reorderDuplicateIds);
		}

		if (new Set(orderIndexes).size !== orderIndexes.length) {
			throw new BadRequestException(LESSON_MESSAGE.reorderDuplicateOrder);
		}

		const expected = new Set(expectedIds);

		if (payloadIds.some((id) => !expected.has(id))) {
			throw new BadRequestException(LESSON_MESSAGE.reorderUnknownIds);
		}

		if (payloadIds.length !== expectedIds.length) {
			throw new BadRequestException(LESSON_MESSAGE.reorderMissingIds);
		}

		const sorted = [...orderIndexes].sort((a, b) => a - b);
		const isContiguous = sorted.every((value, index) => value === index + 1);

		if (!isContiguous) {
			throw new BadRequestException(LESSON_MESSAGE.reorderNotContiguous);
		}
	}

	// =========================================================================
	// Transaction helpers
	// =========================================================================

	/**
	 * Pha 1 của mọi thao tác sắp xếp: đẩy toàn bộ `order_index` của khoá về **số âm**.
	 *
	 * Số âm là vùng đệm an toàn vì `order_index` hợp lệ luôn `>= 1`: không giá trị âm nào trùng với
	 * giá trị đích, nên các lần ghi ở pha 2 không bao giờ vi phạm `uq_lessons_course_order` /
	 * `uq_course_sections_course_order` giữa đường.
	 *
	 * Dùng `QueryBuilder.update()` (không phải `manager.update`) vì cần biểu thức SQL
	 * `-"order_index"` — API `update` của repository chỉ nhận giá trị tĩnh cho mọi dòng.
	 */
	private async shiftSectionOrderToNegative(
		manager: EntityManager,
		courseId: string,
	): Promise<void> {
		await manager
			.createQueryBuilder()
			.update(CourseSection)
			.set({ orderIndex: () => '-"order_index"' })
			.where('"course_id" = :courseId', { courseId })
			.execute();
	}

	private async shiftLessonOrderToNegative(
		manager: EntityManager,
		courseId: string,
	): Promise<void> {
		await manager
			.createQueryBuilder()
			.update(Lesson)
			.set({ orderIndex: () => '-"order_index"' })
			.where('"course_id" = :courseId', { courseId })
			.andWhere('"deleted_at" IS NULL')
			.execute();
	}

	/**
	 * Pha 2: ghi `order_index = 1..n` theo đúng thứ tự mảng đã sắp.
	 *
	 * Dùng `manager.update` (không phải `save`) để không phát sinh `SELECT` cho từng dòng — với một
	 * khoá học vài trăm bài thì đây là khác biệt đáng kể. `updated_at` vẫn đổi (đó là
	 * `@UpdateDateColumn`) nhưng thao tác sắp xếp lại vốn "chạm" vào mọi bài nên chấp nhận được.
	 */
	private async renumberLessons(
		manager: EntityManager,
		courseId: string,
		ordered: Lesson[],
	): Promise<void> {
		for (const [index, lesson] of ordered.entries()) {
			await manager.update(
				Lesson,
				{ id: lesson.id, courseId },
				{ orderIndex: index + 1 },
			);
		}
	}

	// =========================================================================
	// Trình bày & tiện ích nhỏ
	// =========================================================================

	/** Chi tiết đầy đủ của một bài học: học liệu + thống kê suy diễn. */
	private async buildLessonDetail(
		lesson: Lesson,
		section: CourseSection,
	): Promise<LessonDetail> {
		const materials = await this.materials.find({
			where: { lessonId: lesson.id },
			order: { orderIndex: 'ASC', createdAt: 'ASC' },
		});
		const stats = await this.loadMaterialStats([lesson.id]);

		return toLessonDetail(
			lesson,
			stats.get(lesson.id) ?? EMPTY_MATERIAL_STATS,
			materials,
			section,
		);
	}

	private async setLessonPublished(
		id: string,
		isPublished: boolean,
		actor: AuthUser,
	): Promise<LessonPublishState> {
		const lesson = await this.findLessonOrFail(id);
		await this.courseAccess.assertCanManage(lesson.courseId, actor);

		await this.lessons.update(
			{ id },
			{
				isPublished,
				// Đối xứng với chương: bật lại không ghi đè mốc công bố đầu tiên, tắt thì xoá mốc.
				publishedAt: isPublished ? (lesson.publishedAt ?? new Date()) : null,
			},
		);

		const updated = await this.findLessonOrFail(id);

		return {
			id: updated.id,
			isPublished: updated.isPublished,
			updatedAt: updated.updatedAt,
		};
	}

	/** Danh sách định dạng được nhận, viết theo nhãn tiếng Việt, cho thông báo `415`. */
	private describeAllowedMimeTypes(): string {
		return ALLOWED_UPLOAD_MIME_TYPES.map(
			(mime) => UPLOAD_MIME_LABEL[mime] ?? mime,
		).join(', ');
	}

	private toSqlOrder(order: PageOrder): 'ASC' | 'DESC' {
		return order === 'desc' ? 'DESC' : 'ASC';
	}
}
