import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	DataSource,
	EntityManager,
	In,
	IsNull,
	Not,
	QueryFailedError,
	Repository,
	SelectQueryBuilder,
} from 'typeorm';
import { User } from '../user/entities/user.entity';
import { CourseAccessService } from './course-access.service';
import { CourseEligibilityService } from './course-eligibility.service';
import { Category } from './entities/category.entity';
import { Cohort } from './entities/cohort.entity';
import { CourseInstructor } from './entities/course-instructor.entity';
import { CourseSection } from './entities/course-section.entity';
import { Course } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { COURSE_MESSAGE } from './constants/course-message.constant';
import { buildPageMeta, toSkip } from '../common/utils/pagination.util';
import { resolveUniqueSlug, slugify } from './course.util';
import {
	toCohortItem,
	toCourseInstructorItem,
	toCourseListItem,
	toCourseDetail,
	toMyEnrollmentSummary,
} from './course.mapper';
import type { AssignInstructorDto } from './dto/assign-instructor.dto';
import type { CreateCohortDto } from './dto/create-cohort.dto';
import type { CreateCourseDto } from './dto/create-course.dto';
import type { FindCoursesQueryDto } from './dto/find-courses-query.dto';
import type { PublishCourseDto } from './dto/publish-course.dto';
import type { UpdateCourseDto } from './dto/update-course.dto';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { CourseSortField } from './types/course.type';
import type {
	CohortItem,
	CourseDetail,
	CourseInstructorItem,
	CourseListItem,
	MyEnrollmentSummary,
	PaginatedCourses,
} from './types/course.type';
import type { CourseListExtras } from './course.mapper';

/**
 * Cột `ORDER BY` của danh sách khoá học.
 *
 * `enrolledCount` **không** nằm ở đây: nó không phải cột của bảng nên phải sắp qua một bảng dẫn
 * xuất (xem `applyEnrolledCountSort`). Bài học từ lần chạy thật đầu tiên của E3: nhét thẳng subquery
 * tương quan vào `orderBy` làm **mọi** request `sortBy=enrolledCount` trả `500`
 * `alias was not found` — TypeORM quét chuỗi `ORDER BY` để thay tên thuộc tính và tưởng các định
 * danh trong subquery (`"enrollments"`, `"e"`) là alias của bảng đã join.
 *
 * Bảng ánh xạ **đóng**: tên cột không tham số hoá được nên nhận chuỗi tự do từ `sortBy` là lỗ hổng
 * SQL injection (xem `USER_SORT_FIELDS` cho cùng lý do).
 */
const SORT_COLUMN: Record<Exclude<CourseSortField, 'enrolledCount'>, string> = {
	createdAt: 'course.createdAt',
	title: 'course.title',
	code: 'course.code',
};

/** Alias của cột đếm ghi danh được `addSelect` để sắp xếp được theo nó. */
const ENROLLED_COUNT_SORT_ALIAS = 'enrolled_count_sort';

/**
 * Sắp xếp theo số học viên đã ghi danh.
 *
 * Dùng **bảng dẫn xuất 1-1** (`LEFT JOIN` một subquery `GROUP BY course_id`) thay vì subquery tương
 * quan trong `ORDER BY`: mỗi khoá chỉ có đúng một dòng ở bảng dẫn xuất nên `skip`/`take` vẫn đếm
 * đúng, còn TypeORM quản lý được alias `enrollment_count` nên không còn lỗi "alias was not found".
 */
const applyEnrolledCountSort = (
	builder: SelectQueryBuilder<Course>,
	order: 'ASC' | 'DESC',
): void => {
	builder.leftJoin(
		(subQuery) =>
			subQuery
				.select('enrollment.course_id', 'course_id')
				.addSelect('COUNT(*)', 'total')
				.from('enrollments', 'enrollment')
				.where(ENROLLED_CONDITION)
				.groupBy('enrollment.course_id'),
		'enrollment_count',
		'enrollment_count.course_id = course.id',
	);
	builder.addSelect(
		`COALESCE(enrollment_count.total, 0)`,
		ENROLLED_COUNT_SORT_ALIAS,
	);
	builder.orderBy(ENROLLED_COUNT_SORT_ALIAS, order);
};

/** Điều kiện đếm "học viên thực sự học" — dùng chung cho danh sách, chi tiết và sắp xếp. */
const ENROLLED_CONDITION = `"enrollment"."status" <> 'dropped'`;
const UNIQUE_VIOLATION_CODE = '23505';

/** Tên index duy nhất → thông điệp `409` tương ứng (đọc từ `driverError.constraint`). */
const CONSTRAINT_MESSAGE: Record<string, string> = {
	uq_courses_code: COURSE_MESSAGE.codeExists,
	uq_courses_slug: COURSE_MESSAGE.slugExists,
};

/**
 * `driverError` của `pg` chỉ được khai là `Error`, nên `code`/`constraint` phải đọc qua kiểu giao
 * (`Error & {...}`) — `QueryFailedError` đòi tham số generic thoả `Error`.
 */
type PgDriverError = Error & { code?: string; constraint?: string };

const driverError = (error: unknown): PgDriverError | undefined =>
	error instanceof QueryFailedError
		? (error.driverError as PgDriverError)
		: undefined;

const isUniqueViolation = (error: unknown): boolean =>
	driverError(error)?.code === UNIQUE_VIOLATION_CODE;

/**
 * Nghiệp vụ khoá học (E3-T1) và điều kiện tiên quyết (E3-T5).
 *
 * **Quyền luôn đi qua `CourseAccessService`**, không tự viết lại điều kiện: định nghĩa "được xem"/
 * "được sửa" chỉ tồn tại ở một chỗ, nếu không thì `LessonModule` và `CourseModule` sẽ lệch nhau.
 *
 * **Số liệu (section/lesson/enrolled) luôn nạp theo lô**: một trang 100 khoá học mà đếm từng khoá
 * là 300 truy vấn cho một request danh sách — đây là lỗi hiệu năng kinh điển của catalog và cũng
 * là thứ e2e không phát hiện được (kết quả vẫn đúng, chỉ chậm).
 */
@Injectable()
export class CourseService {
	constructor(
		@InjectRepository(Course)
		private readonly courses: Repository<Course>,
		@InjectRepository(Category)
		private readonly categories: Repository<Category>,
		@InjectRepository(Cohort)
		private readonly cohorts: Repository<Cohort>,
		@InjectRepository(CourseInstructor)
		private readonly instructors: Repository<CourseInstructor>,
		@InjectRepository(Enrollment)
		private readonly enrollments: Repository<Enrollment>,
		@InjectRepository(User)
		private readonly users: Repository<User>,
		private readonly dataSource: DataSource,
		private readonly courseAccessService: CourseAccessService,
		private readonly courseEligibilityService: CourseEligibilityService,
	) {}

	/** `GET /api/courses` (E3-T1) — catalog có tìm kiếm, lọc, phân trang. */
	async findMany(
		query: FindCoursesQueryDto,
		actor: AuthUser,
	): Promise<PaginatedCourses> {
		const { page, take, order, search, sortBy } = query;

		const builder = this.courses
			.createQueryBuilder('course')
			// Bắt buộc: `toCourseListItem` đọc `course.owner.id` và `course.category`. Hai quan hệ
			// này là `ManyToOne` nên join không nhân dòng — `skip`/`take` vẫn đúng.
			.leftJoinAndSelect('course.owner', 'owner')
			.leftJoinAndSelect('course.category', 'category')
			.where('course.deletedAt IS NULL');

		// Phạm vi theo vai trò **trước** mọi bộ lọc của client: bộ lọc chỉ thu hẹp tập đã được phép,
		// không bao giờ mở rộng.
		this.courseAccessService.applyVisibilityScope(builder, actor);

		if (query.categoryId) {
			builder.andWhere('course.categoryId = :categoryId', {
				categoryId: query.categoryId,
			});
		}

		if (query.status && query.status.length > 0) {
			builder.andWhere('course.status IN (:...statuses)', {
				statuses: query.status,
			});
		}

		if (query.semester) {
			builder.andWhere('course.semester = :semester', {
				semester: query.semester,
			});
		}

		if (query.ownerId) {
			builder.andWhere('course.ownerId = :ownerId', {
				ownerId: query.ownerId,
			});
		}

		if (query.level) {
			builder.andWhere('course.level = :level', { level: query.level });
		}

		if (search) {
			// `COALESCE(summary, '')` để khoá không có mô tả ngắn vẫn so sánh được: `NULL LIKE ...` là
			// `NULL` (không phải `false`) nên không có `COALESCE` thì điều kiện OR sẽ nuốt mất kết quả.
			builder.andWhere(
				`(LOWER(course.title) LIKE :keyword
					OR LOWER(course.code) LIKE :keyword
					OR LOWER(COALESCE(course.summary, '')) LIKE :keyword)`,
				{ keyword: `%${search.toLowerCase()}%` },
			);
		}

		// `enrolledCount` đi đường riêng (bảng dẫn xuất + `addSelect`) — xem `applyEnrolledCountSort`.
		const sortDirection = order.toUpperCase() as 'ASC' | 'DESC';

		if (sortBy === 'enrolledCount') {
			applyEnrolledCountSort(builder, sortDirection);
		} else {
			builder.orderBy(SORT_COLUMN[sortBy], sortDirection);
		}

		const [rows, total] = await builder
			// Khoá phụ bắt buộc: `createdAt`/`title` có thể trùng giữa nhiều khoá, và khi đó thứ tự
			// giữa hai trang không xác định — bản ghi có thể xuất hiện hai lần hoặc bị bỏ sót.
			.addOrderBy('course.id', 'ASC')
			.skip(toSkip(page, take))
			.take(take)
			.getManyAndCount();

		return {
			items: await this.loadListItems(rows, actor.id),
			// `itemCount` là TỔNG số bản ghi khớp điều kiện (xem `pagination.util.ts`).
			meta: buildPageMeta(total, page, take),
		};
	}

	/** `GET /api/courses/:id` (E3-T1/E3-T5) — chi tiết kèm giảng viên, tiên quyết, điều kiện. */
	async findOne(id: string, actor: AuthUser): Promise<CourseDetail> {
		await this.courseAccessService.assertCanView(id, actor);

		return this.buildDetail(id, actor);
	}

	/** `POST /api/courses` (E3-T1) — `teacher` hoặc `admin`. */
	async create(dto: CreateCourseDto, actor: AuthUser): Promise<CourseDetail> {
		const ownerId = await this.resolveOwnerId(dto.ownerId, actor);

		await this.assertCodeAvailable(dto.code);
		const slug = await resolveUniqueSlug(
			this.courses,
			dto.slug && dto.slug.length > 0 ? dto.slug : slugify(dto.title),
		);

		if (dto.categoryId) {
			await this.findCategoryOrFail(dto.categoryId);
		}

		const course = this.courses.create({
			code: dto.code,
			title: dto.title,
			slug,
			summary: dto.summary ?? null,
			description: dto.description ?? null,
			categoryId: dto.categoryId ?? null,
			ownerId,
			coverUrl: dto.coverUrl ?? null,
			level: dto.level ?? null,
			language: dto.language ?? 'vi',
			semester: dto.semester ?? null,
			// `status` và `published_at` cố ý không nhận từ client: mọi khoá mới là bản nháp.
			status: 'draft',
			visibility: dto.visibility ?? 'public',
			estimatedHours: dto.estimatedHours ?? null,
			enrollmentOpen: dto.enrollmentOpen ?? true,
			maxStudents: dto.maxStudents ?? null,
			createdBy: actor.id,
		});

		// Khoá học và dòng phân công chủ sở hữu phải cùng sống hoặc cùng chết: nếu `course_instructors`
		// thiếu dòng `owner`, RBAC tầng truy vấn (E8) sẽ không thấy chủ sở hữu nào cho khoá này.
		const created = await this.withUniqueTranslation(async () =>
			this.dataSource.transaction(async (manager) => {
				const saved = await manager.save(course);

				await manager.save(
					manager.create(CourseInstructor, {
						courseId: saved.id,
						userId: saved.ownerId,
						roleInCourse: 'owner',
						assignedBy: actor.id,
					}),
				);

				return saved;
			}),
		);

		return this.buildDetail(created.id, actor);
	}

	/** `PATCH /api/courses/:id` (E3-T1) — `teacher` (được phân công) hoặc `admin`. */
	async update(
		id: string,
		dto: UpdateCourseDto,
		actor: AuthUser,
	): Promise<CourseDetail> {
		const course = await this.courseAccessService.assertCanManage(id, actor);

		if (dto.code !== undefined && dto.code !== course.code) {
			await this.assertCodeAvailable(dto.code, id);
		}

		if (dto.ownerId !== undefined) {
			// Đổi chủ sở hữu là thao tác quản trị: giảng viên đồng phụ trách không được tự chuyển khoá
			// học sang người khác (kể cả khi họ đang có toàn quyền nội dung).
			if (actor.role !== 'admin') {
				throw new ForbiddenException(COURSE_MESSAGE.notManageable);
			}

			if (dto.ownerId !== course.ownerId) {
				await this.assertTeacherExists(dto.ownerId);
			}
		}

		if (dto.categoryId !== undefined && dto.categoryId !== null) {
			await this.findCategoryOrFail(dto.categoryId);
		}

		// Slug được sinh lại chỉ khi client đổi `title` mà không gửi `slug`: đổi slug mỗi lần sửa mô
		// tả sẽ phá các liên kết đã chia sẻ.
		let slug = dto.slug;
		if (
			slug === undefined &&
			dto.title !== undefined &&
			dto.title !== course.title
		) {
			slug = await resolveUniqueSlug(this.courses, slugify(dto.title), id);
		} else if (slug !== undefined) {
			slug = await resolveUniqueSlug(this.courses, slug, id);
		}

		const changes: Partial<Course> = {};
		if (dto.code !== undefined) changes.code = dto.code;
		if (dto.title !== undefined) changes.title = dto.title;
		if (slug !== undefined) changes.slug = slug;
		if (dto.summary !== undefined) changes.summary = dto.summary;
		if (dto.description !== undefined) changes.description = dto.description;
		if (dto.categoryId !== undefined) changes.categoryId = dto.categoryId;
		if (dto.coverUrl !== undefined) changes.coverUrl = dto.coverUrl;
		if (dto.level !== undefined) changes.level = dto.level;
		if (dto.language !== undefined) changes.language = dto.language;
		if (dto.semester !== undefined) changes.semester = dto.semester;
		if (dto.visibility !== undefined) changes.visibility = dto.visibility;
		if (dto.estimatedHours !== undefined) {
			changes.estimatedHours = dto.estimatedHours;
		}
		if (dto.enrollmentOpen !== undefined) {
			changes.enrollmentOpen = dto.enrollmentOpen;
		}
		if (dto.maxStudents !== undefined) changes.maxStudents = dto.maxStudents;
		if (dto.ownerId !== undefined) changes.ownerId = dto.ownerId;

		const ownerChanged =
			dto.ownerId !== undefined && dto.ownerId !== course.ownerId;

		if (Object.keys(changes).length > 0 || ownerChanged) {
			await this.withUniqueTranslation(() =>
				this.dataSource.transaction(async (manager) => {
					if (Object.keys(changes).length > 0) {
						await manager.update(Course, { id }, changes);
					}

					if (ownerChanged) {
						await this.syncOwnerAssignment(
							manager,
							id,
							dto.ownerId as string,
							actor.id,
						);
					}
				}),
			);
		}

		return this.buildDetail(id, actor);
	}

	/**
	 * `DELETE /api/courses/:id` (E3-T1) — xoá mềm.
	 *
	 * **Vì sao chặn khi đã có ghi danh:** xoá mềm khoá học sẽ làm mọi `enrollments`/`lesson_progress`
	 * trỏ tới một khoá không còn đọc được — dữ liệu học tập (E5/E8) mất ngữ cảnh. `409` buộc dùng
	 * `unpublish` nếu chỉ muốn ẩn khỏi catalog.
	 */
	async remove(id: string, actor: AuthUser): Promise<void> {
		await this.courseAccessService.assertCanManage(id, actor);

		const enrollmentCount = await this.enrollments.count({
			where: { courseId: id },
		});

		if (enrollmentCount > 0) {
			throw new ConflictException(COURSE_MESSAGE.deleteHasEnrollment);
		}

		await this.courses.update({ id }, { deletedAt: new Date() });
	}

	/** `PATCH /api/courses/:id/publish` (E3-T1). */
	async publish(
		id: string,
		dto: PublishCourseDto,
		actor: AuthUser,
	): Promise<{ id: string; status: string; updatedAt: Date }> {
		const course = await this.courseAccessService.assertCanManage(id, actor);

		const hasLesson = await this.dataSource
			.createQueryBuilder()
			.select('1')
			.from('lessons', 'lesson')
			.where('lesson.course_id = :id', { id })
			.andWhere('lesson.deleted_at IS NULL')
			.getExists();

		if (!hasLesson) {
			throw new BadRequestException(COURSE_MESSAGE.publishNeedsLesson);
		}

		const publishedAt = course.publishedAt ?? new Date();

		await this.withUniqueTranslation(() =>
			this.dataSource.transaction(async (manager) => {
				await manager.update(
					Course,
					{ id },
					{ status: 'published', publishedAt },
				);

				if (dto.publishLessons) {
					// `published_at = COALESCE(published_at, now())`: bài đã công bố từ trước giữ nguyên
					// mốc thời gian gốc, chỉ bài chưa công bố mới được ghi mốc mới.
					await manager.query(
						`UPDATE "lessons" SET "is_published" = true,
							"published_at" = COALESCE("published_at", now())
						 WHERE "course_id" = $1 AND "deleted_at" IS NULL`,
						[id],
					);

					await manager.query(
						`UPDATE "course_sections" SET "is_published" = true,
							"published_at" = COALESCE("published_at", now())
						 WHERE "course_id" = $1`,
						[id],
					);
				}
			}),
		);

		return this.statusPatchResult(id);
	}

	/**
	 * `PATCH /api/courses/:id/unpublish` (E3-T1).
	 *
	 * **`published_at` cố ý giữ nguyên**, không set `NULL`: cột đó ghi *lần đầu được công bố*, là dữ
	 * liệu cho phân tích (một khoá bị ẩn rồi công bố lại vẫn là khoá đã từng lên sóng). Xoá mốc
	 * thời gian này là mất thông tin không lấy lại được.
	 *
	 * Các dòng `enrollments` **không bị đụng tới** — đây là DoD của E3-T1: ẩn khoá học chỉ làm nó
	 * biến mất khỏi catalog học viên, tiến độ học tập vẫn nguyên vẹn.
	 */
	async unpublish(
		id: string,
		actor: AuthUser,
	): Promise<{ id: string; status: string; updatedAt: Date }> {
		await this.courseAccessService.assertCanManage(id, actor);
		await this.courses.update({ id }, { status: 'draft' });

		return this.statusPatchResult(id);
	}

	/** `GET /api/courses/:id/instructors` (E3-T1). */
	async findInstructors(
		id: string,
		actor: AuthUser,
	): Promise<CourseInstructorItem[]> {
		await this.courseAccessService.assertCanView(id, actor);

		return this.loadInstructors(id);
	}

	/** `POST /api/courses/:id/instructors` (E3-T1). */
	async assignInstructor(
		id: string,
		dto: AssignInstructorDto,
		actor: AuthUser,
	): Promise<CourseInstructorItem> {
		await this.courseAccessService.assertCanManage(id, actor);
		await this.assertTeacherExists(dto.userId);

		const cohortId = dto.cohortId ?? null;

		if (cohortId) {
			await this.findCourseCohortOrFail(id, cohortId);
		}

		const alreadyAssigned = await this.instructors
			.createQueryBuilder('instructor')
			.where('instructor.courseId = :id', { id })
			.andWhere('instructor.userId = :userId', { userId: dto.userId })
			.andWhere(
				cohortId
					? 'instructor.cohortId = :cohortId'
					: 'instructor.cohortId IS NULL',
				cohortId ? { cohortId } : {},
			)
			.getExists();

		if (alreadyAssigned) {
			throw new ConflictException(COURSE_MESSAGE.instructorExists);
		}

		const assignment = this.instructors.create({
			courseId: id,
			userId: dto.userId,
			roleInCourse: dto.roleInCourse ?? 'co_instructor',
			cohortId,
			assignedBy: actor.id,
		});

		try {
			const saved = await this.instructors.save(assignment);
			const items = await this.loadInstructors(id);

			return (
				items.find((item) => item.id === saved.id) ?? {
					id: saved.id,
					userId: saved.userId,
					fullName: '',
					email: '',
					roleInCourse: saved.roleInCourse,
					cohortId: saved.cohortId,
					cohortName: null,
					assignedAt: saved.assignedAt,
				}
			);
		} catch (error) {
			// Lưới an toàn cho đua: ràng buộc duy nhất là **index biểu thức**
			// `UNIQUE (course_id, user_id, COALESCE(cohort_id, '000…0'))`, nên hai request song song
			// cùng vượt được `count` ở trên và một trong hai nhận `23505` từ Postgres.
			this.rethrowDuplicate(error);
			throw error;
		}
	}

	/**
	 * `DELETE /api/courses/:id/instructors/:userId` (E3-T1).
	 *
	 * Chủ sở hữu **không** gỡ được: `courses.owner_id` vẫn là nguồn chân lý cho quyền quản lý, nên
	 * gỡ dòng `owner` sẽ để lại khoá học có chủ sở hữu "vô hình" trong bảng phân công. Muốn đổi thì
	 * `PATCH /api/courses/:id` với `ownerId` (admin).
	 */
	async removeInstructor(
		id: string,
		userId: string,
		actor: AuthUser,
	): Promise<void> {
		const course = await this.courseAccessService.assertCanManage(id, actor);

		if (userId === course.ownerId) {
			throw new BadRequestException(COURSE_MESSAGE.instructorIsOwner);
		}

		const result = await this.instructors.delete({ courseId: id, userId });

		if (!result.affected) {
			throw new NotFoundException(COURSE_MESSAGE.instructorNotFound);
		}
	}

	/** `GET /api/courses/:id/cohorts` (E3-T1). */
	async findCohorts(id: string, actor: AuthUser): Promise<CohortItem[]> {
		await this.courseAccessService.assertCanView(id, actor);

		return this.loadCohorts(id);
	}

	/** `POST /api/courses/:id/cohorts` (E3-T1). */
	async createCohort(
		id: string,
		dto: CreateCohortDto,
		actor: AuthUser,
	): Promise<CohortItem> {
		await this.courseAccessService.assertCanManage(id, actor);
		this.assertDateRange(dto.startsOn ?? null, dto.endsOn ?? null);
		await this.assertClassCodeAvailable(id, dto.classCode ?? null);

		const cohort = this.cohorts.create({
			courseId: id,
			name: dto.name,
			classCode: dto.classCode ?? null,
			groupCode: dto.groupCode ?? null,
			semester: dto.semester ?? null,
			startsOn: dto.startsOn ?? null,
			endsOn: dto.endsOn ?? null,
		});

		try {
			const saved = await this.cohorts.save(cohort);

			return toCohortItem(saved, 0);
		} catch (error) {
			this.rethrowDuplicate(error);
			throw error;
		}
	}

	/** `PUT /api/courses/:id/prerequisites` (E3-T5). */
	async replacePrerequisites(
		id: string,
		courseIds: string[],
		actor: AuthUser,
	): Promise<CourseDetail['prerequisites']> {
		await this.courseAccessService.assertCanManage(id, actor);

		return this.courseEligibilityService.replacePrerequisites(id, courseIds);
	}

	/**
	 * Chi tiết đầy đủ của một khoá học.
	 *
	 * `eligibility` chỉ được tính cho `student`: `teacher`/`admin` không ghi danh nên cờ "đủ điều
	 * kiện" vô nghĩa với họ, và tính nó sẽ tốn thêm hai truy vấn cho mọi lần mở trang soạn bài.
	 */
	async buildDetail(id: string, actor: AuthUser): Promise<CourseDetail> {
		const course = await this.findCourseOrFail(id);
		const [items, prerequisites, instructors, eligibility] = await Promise.all([
			this.loadListItems([course], actor.id),
			this.courseEligibilityService.listPrerequisites(
				id,
				actor.role === 'student' ? actor.id : undefined,
			),
			this.loadInstructors(id),
			actor.role === 'student'
				? this.courseEligibilityService.evaluate(id, actor.id)
				: Promise.resolve(null),
		]);

		// `loadListItems` luôn trả đúng một phần tử cho một khoá học đã tồn tại, nên `items[0]` chắc
		// chắn có giá trị; ép kiểu ở đây để không phải rải kiểm tra `undefined` khắp hàm.
		const extras = items[0] as CourseListExtras;

		return toCourseDetail(course, extras, {
			prerequisites,
			instructors,
			eligibility,
		});
	}

	/** Danh sách lớp của khoá, kèm `memberCount` tính theo lô. */
	async loadCohorts(courseId: string): Promise<CohortItem[]> {
		const rows = await this.cohorts
			.createQueryBuilder('cohort')
			.where('cohort.courseId = :courseId', { courseId })
			// `NULLS LAST`: lớp chưa có mã nằm cuối thay vì đầu (Postgres mặc định `NULLS FIRST` cho
			// `ASC`), để danh sách đọc theo mã lớp như người dùng mong đợi.
			.orderBy('cohort.classCode', 'ASC', 'NULLS LAST')
			.addOrderBy('cohort.createdAt', 'ASC')
			.addOrderBy('cohort.id', 'ASC')
			.getMany();

		const memberCounts = await this.countEnrollmentsByCohort(courseId);

		return rows.map((row) => toCohortItem(row, memberCounts.get(row.id) ?? 0));
	}

	/** Bọc `findCourseOrFail` của `CourseAccessService` cho các service khác trong module. */
	async findCourseOrFail(id: string): Promise<Course> {
		return this.courseAccessService.findCourseOrFail(id);
	}

	/** `assertCanManage` dùng bởi `CohortService` (lớp không tự biết quyền của khoá chứa nó). */
	async assertCanManageCourse(id: string, actor: AuthUser): Promise<Course> {
		return this.courseAccessService.assertCanManage(id, actor);
	}

	/** Đếm ghi danh theo lớp cho **một** khoá — một truy vấn gộp thay vì N+1. */
	private async countEnrollmentsByCohort(
		courseId: string,
	): Promise<Map<string, number>> {
		const rows = await this.enrollments
			.createQueryBuilder('enrollment')
			.select('enrollment.cohortId', 'cohort_id')
			.addSelect('COUNT(enrollment.id)', 'total')
			.where('enrollment.courseId = :courseId', { courseId })
			.andWhere('enrollment.cohortId IS NOT NULL')
			.groupBy('enrollment.cohortId')
			.getRawMany<{ cohort_id: string; total: string }>();

		return new Map(rows.map((row) => [row.cohort_id, Number(row.total)]));
	}

	/** Nạp mọi số liệu của một trang khoá học bằng 5 truy vấn gộp (không phụ thuộc số dòng). */
	private async loadListItems(
		rows: Course[],
		actorId: string,
	): Promise<CourseListItem[]> {
		if (rows.length === 0) return [];

		const courseIds = rows.map((row) => row.id);
		const [sectionCounts, lessonCounts, enrolledCounts, myEnrollments] =
			await Promise.all([
				this.countSections(courseIds),
				this.countLessons(courseIds),
				this.countEnrollments(courseIds),
				this.loadMyEnrollments(courseIds, actorId),
			]);

		return rows.map((row) =>
			toCourseListItem(row, {
				sectionCount: sectionCounts.get(row.id) ?? 0,
				lessonCount: lessonCounts.get(row.id) ?? 0,
				enrolledCount: enrolledCounts.get(row.id) ?? 0,
				myEnrollment: myEnrollments.get(row.id) ?? null,
			}),
		);
	}

	private async countSections(
		courseIds: string[],
	): Promise<Map<string, number>> {
		const rows = await this.dataSource
			.getRepository(CourseSection)
			.createQueryBuilder('section')
			.select('section.courseId', 'course_id')
			.addSelect('COUNT(section.id)', 'total')
			.where('section.courseId IN (:...courseIds)', { courseIds })
			.groupBy('section.courseId')
			.getRawMany<{ course_id: string; total: string }>();

		return new Map(rows.map((row) => [row.course_id, Number(row.total)]));
	}

	/**
	 * Đếm bài học chưa xoá mềm.
	 *
	 * Dùng truy vấn thô trên bảng `lessons` (không import entity của `LessonModule`): hai module
	 * được viết song song ở E3, và `CourseModule` chỉ cần một phép đếm — phụ thuộc vào entity của
	 * module khác sẽ biến một thay đổi schema bên đó thành lỗi biên dịch ở đây.
	 */
	private async countLessons(
		courseIds: string[],
	): Promise<Map<string, number>> {
		const rows: { course_id: string; total: string }[] = await this.dataSource
			.createQueryBuilder()
			.select('lesson.course_id', 'course_id')
			.addSelect('COUNT(lesson.id)', 'total')
			.from('lessons', 'lesson')
			.where('lesson.course_id IN (:...courseIds)', { courseIds })
			.andWhere('lesson.deleted_at IS NULL')
			.groupBy('lesson.course_id')
			.getRawMany();

		return new Map(rows.map((row) => [row.course_id, Number(row.total)]));
	}

	/**
	 * Đếm học viên "thực sự học": `status <> 'dropped'`.
	 *
	 * Bản ghi `dropped` không bị xoá (giữ lịch sử) nên nếu đếm cả chúng thì sĩ số hiển thị luôn lớn
	 * hơn thực tế và `max_students` sẽ chặn nhầm.
	 */
	private async countEnrollments(
		courseIds: string[],
	): Promise<Map<string, number>> {
		const rows: { course_id: string; total: string }[] = await this.dataSource
			.createQueryBuilder()
			.select('enrollment.course_id', 'course_id')
			.addSelect('COUNT(enrollment.id)', 'total')
			.from('enrollments', 'enrollment')
			.where('enrollment.course_id IN (:...courseIds)', { courseIds })
			.andWhere(ENROLLED_CONDITION)
			.groupBy('enrollment.course_id')
			.getRawMany();

		return new Map(rows.map((row) => [row.course_id, Number(row.total)]));
	}

	/** Ghi danh **của người gọi** cho cả trang — một truy vấn, không phải một truy vấn mỗi dòng. */
	private async loadMyEnrollments(
		courseIds: string[],
		actorId: string,
	): Promise<Map<string, MyEnrollmentSummary>> {
		const rows = await this.enrollments.find({
			where: { userId: actorId, courseId: In(courseIds) },
		});

		return new Map(
			rows.map((row) => [row.courseId, toMyEnrollmentSummary(row)]),
		);
	}

	private async loadInstructors(
		courseId: string,
	): Promise<CourseInstructorItem[]> {
		const rows = await this.instructors.find({
			where: { courseId },
			relations: { user: true, cohort: true },
			// `id` làm khoá phụ: hai phân công cùng `assigned_at` (chèn trong cùng transaction) vẫn có
			// thứ tự xác định.
			order: { assignedAt: 'ASC', id: 'ASC' },
		});

		return rows.map((instructor) =>
			toCourseInstructorItem({
				instructor,
				user: instructor.user ?? null,
				cohort: instructor.cohort ?? null,
			}),
		);
	}

	/**
	 * Giữ `courses.owner_id` và dòng `owner` trong `course_instructors` đồng bộ.
	 *
	 * Thứ tự thao tác quan trọng: **thêm dòng mới trước, xoá dòng cũ sau**. Nếu làm ngược lại thì
	 * trong khoảng giữa hai câu lệnh khoá học không có dòng `owner` nào — một request đọc song song
	 * (hoặc một lỗi mạng giữa chừng) sẽ thấy khoá học "mồ côi" chủ sở hữu. Transaction bao ngoài
	 * bảo đảm người ngoài chỉ thấy trạng thái trước hoặc sau.
	 *
	 * **Vì sao nâng cấp tại chỗ thay vì chèn dòng `owner` mới:** ràng buộc duy nhất là index biểu
	 * thức `UNIQUE (course_id, user_id, COALESCE(cohort_id, '000…0'))`, nên chèn thêm một dòng nữa
	 * cho người **đã** được phân công (dù ở phạm vi khoá hay phạm vi lớp) sẽ vi phạm `23505`. Nâng
	 * vai trò của dòng sẵn có là cách duy nhất vừa giữ đúng một dòng `owner`, vừa không tạo khoảng
	 * trống. Dòng `owner` theo lớp là hợp lệ (`cohort_id` NULL nghĩa là cả khoá).
	 */
	private async syncOwnerAssignment(
		manager: EntityManager,
		courseId: string,
		newOwnerId: string,
		actorId: string,
	): Promise<void> {
		const existing = await manager.findOne(CourseInstructor, {
			where: { courseId, userId: newOwnerId },
			order: { id: 'ASC' },
		});

		if (existing) {
			await manager.update(
				CourseInstructor,
				{ id: existing.id },
				{ roleInCourse: 'owner' },
			);

			// Nếu người này còn dòng phân công thứ hai (ví dụ trợ giảng ở một lớp khác), giữ lại cả hai
			// sẽ khiến cùng một người xuất hiện hai lần với một dòng `owner` — dọn ngay trong cùng
			// transaction để trạng thái cuối cùng là xác định.
			await manager.delete(CourseInstructor, {
				courseId,
				userId: newOwnerId,
				id: Not(existing.id),
			});
		} else {
			await manager.save(
				manager.create(CourseInstructor, {
					courseId,
					userId: newOwnerId,
					roleInCourse: 'owner',
					cohortId: null,
					assignedBy: actorId,
				}),
			);
		}

		await manager.delete(CourseInstructor, {
			courseId,
			roleInCourse: 'owner',
			userId: Not(newOwnerId),
		});
	}

	/**
	 * Xác định chủ sở hữu của khoá học mới.
	 *
	 * `teacher` luôn là chủ sở hữu khoá mình tạo (`ownerId` trong body bị **bỏ qua**, không phải
	 * `400`: FE dùng chung form cho hai vai trò). `admin` phải chỉ định một người dùng có vai trò
	 * `teacher` đang hoạt động — khoá học không thể thuộc về học viên, và `owner_id` là `NOT NULL`.
	 */
	private async resolveOwnerId(
		requestedOwnerId: string | undefined,
		actor: AuthUser,
	): Promise<string> {
		if (actor.role !== 'admin') return actor.id;

		if (!requestedOwnerId) {
			// Thông điệp riêng cho trường hợp **thiếu** `ownerId`, không dùng chung với
			// `ownerNotFound`: khi admin bỏ trống ô này, câu "không tìm thấy giảng viên phụ trách"
			// khiến người dùng tưởng mình đã chọn sai người, trong khi lỗi thật là chưa chọn ai.
			throw new BadRequestException(COURSE_MESSAGE.ownerRequired);
		}

		await this.assertTeacherExists(requestedOwnerId);

		return requestedOwnerId;
	}

	/** Người dùng phải tồn tại, chưa bị xoá mềm và có vai trò `teacher`. */
	private async assertTeacherExists(userId: string): Promise<User> {
		const user = await this.users.findOne({
			where: { id: userId, deletedAt: IsNull() },
		});

		if (!user) {
			throw new BadRequestException(COURSE_MESSAGE.ownerNotFound);
		}

		if (user.role !== 'teacher') {
			throw new BadRequestException(COURSE_MESSAGE.ownerMustBeTeacher);
		}

		return user;
	}

	private async assertCodeAvailable(
		code: string,
		exceptId?: string,
	): Promise<void> {
		const builder = this.courses
			.createQueryBuilder('course')
			.where('LOWER(course.code) = LOWER(:code)', { code });

		if (exceptId) {
			builder.andWhere('course.id <> :exceptId', { exceptId });
		}

		if (await builder.getExists()) {
			throw new ConflictException(COURSE_MESSAGE.codeExists);
		}
	}

	/**
	 * `400` khi khoảng thời gian đảo ngược — CHECK ở DB chỉ là chốt chặn cuối.
	 *
	 * `public` vì `CohortService` (PATCH `/api/cohorts/:id`) phải kiểm tra **cùng** quy tắc trên giá
	 * trị đã ghép giữa bản ghi hiện có và phần client gửi lên.
	 */
	assertDateRange(startsOn: string | null, endsOn: string | null): void {
		if (startsOn && endsOn && endsOn < startsOn) {
			throw new BadRequestException(
				'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.',
			);
		}
	}

	/** `409` khi mã lớp đã dùng trong **cùng** khoá học; `exceptId` để PATCH bỏ qua chính nó. */
	async assertClassCodeAvailable(
		courseId: string,
		classCode: string | null,
		exceptId?: string,
	): Promise<void> {
		if (!classCode) return;

		const builder = this.cohorts
			.createQueryBuilder('cohort')
			.where('cohort.courseId = :courseId', { courseId })
			.andWhere('cohort.classCode = :classCode', { classCode });

		if (exceptId) {
			builder.andWhere('cohort.id <> :exceptId', { exceptId });
		}

		if (await builder.getExists()) {
			throw new ConflictException(COURSE_MESSAGE.cohortClassExists);
		}
	}

	async findCourseCohortOrFail(
		courseId: string,
		cohortId: string,
	): Promise<Cohort> {
		const cohort = await this.cohorts.findOne({
			where: { id: cohortId, courseId },
		});

		if (!cohort) {
			throw new NotFoundException(COURSE_MESSAGE.cohortNotFound(cohortId));
		}

		return cohort;
	}

	private async findCategoryOrFail(id: string): Promise<Category> {
		const category = await this.categories.findOne({ where: { id } });

		if (!category) {
			throw new NotFoundException(COURSE_MESSAGE.categoryNotFound(id));
		}

		return category;
	}

	/** `{ id, status, updatedAt }` đọc lại từ DB để trả đúng giá trị `updated_at` sau khi ghi. */
	private async statusPatchResult(
		id: string,
	): Promise<{ id: string; status: string; updatedAt: Date }> {
		const course = await this.findCourseOrFail(id);

		return {
			id: course.id,
			status: course.status,
			updatedAt: course.updatedAt,
		};
	}

	/** Dịch vi phạm ràng buộc duy nhất (`23505`) thành `409` có thông điệp tiếng Việt. */
	private rethrowDuplicate(error: unknown): void {
		if (!isUniqueViolation(error)) return;

		const constraint = driverError(error)?.constraint;

		throw new ConflictException(
			CONSTRAINT_MESSAGE[constraint ?? ''] ?? COURSE_MESSAGE.slugExists,
		);
	}

	private async withUniqueTranslation<T>(action: () => Promise<T>): Promise<T> {
		try {
			return await action();
		} catch (error) {
			this.rethrowDuplicate(error);
			throw error;
		}
	}
}
