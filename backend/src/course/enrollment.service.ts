import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Cohort } from './entities/cohort.entity';
import { Course } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { Lesson } from '../lesson/entities/lesson.entity';
import { LessonProgress } from '../lesson/entities/lesson-progress.entity';
import { CourseAccessService } from './course-access.service';
import { CourseEligibilityService } from './course-eligibility.service';
import { COURSE_MESSAGE } from './constants/course-message.constant';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import type { FindEnrollmentsQueryDto } from './dto/find-enrollments-query.dto';
import { buildPageMeta, toSkip } from '../common/utils/pagination.util';
import type { EnrollmentStatus } from '../common/types';
import type {
	CourseProgressSummary,
	EnrollmentListItem,
	EnrollmentProgress,
	EnrollmentSectionProgress,
	MyEnrollmentSummary,
} from './types/course.type';

export interface PaginatedEnrollments {
	items: EnrollmentListItem[];
	meta: ReturnType<typeof buildPageMeta>;
}

/**
 * Ghi danh và tiến độ (E3-T7, E4-T1→T3).
 *
 * **Vì sao cần ở E3:** DoD của E3-T7 đòi "nút đăng ký gọi API thật và phản ánh trạng thái đã
 * đăng ký", mà trước E3 chưa có đường nào tạo dòng `enrollments`. Không có nó thì nút đăng ký chỉ
 * là giao diện giả, và `GET /api/lessons/:id` (E3-T2) không thể kiểm chứng quy tắc "học viên phải
 * đã ghi danh mới xem được bài".
 *
 * E3 đã kéo `POST /api/enrollments` lên trước để nút đăng ký hoạt động thật; E4 bổ sung list/detail,
 * huỷ, phần trăm tiến độ, hoàn thành bài và resume.
 */
@Injectable()
export class EnrollmentService {
	constructor(
		@InjectRepository(Enrollment)
		private readonly enrollmentRepository: Repository<Enrollment>,
		@InjectRepository(Course)
		private readonly courseRepository: Repository<Course>,
		@InjectRepository(Cohort)
		private readonly cohortRepository: Repository<Cohort>,
		@InjectRepository(Lesson)
		private readonly lessonRepository: Repository<Lesson>,
		@InjectRepository(LessonProgress)
		private readonly progressRepository: Repository<LessonProgress>,
		private readonly courseEligibilityService: CourseEligibilityService,
		private readonly courseAccess: CourseAccessService,
	) {}

	async findAll(
		actor: AuthUser,
		query: FindEnrollmentsQueryDto,
	): Promise<PaginatedEnrollments> {
		if (actor.role === 'student' && query.userId) {
			throw new ForbiddenException(
				'Bạn chỉ có thể xem dữ liệu của chính mình.',
			);
		}

		const builder = this.enrollmentRepository
			.createQueryBuilder('enrollment')
			.innerJoinAndSelect('enrollment.course', 'course')
			.innerJoinAndSelect('enrollment.user', 'student')
			.where('course.deletedAt IS NULL');

		if (actor.role === 'student') {
			builder.andWhere('enrollment.userId = :actorId', { actorId: actor.id });
		} else if (actor.role === 'teacher') {
			builder.andWhere(
				`(course.ownerId = :actorId OR EXISTS (
					SELECT 1 FROM course_instructors ci
					WHERE ci.course_id = enrollment.course_id
						AND ci.user_id = :actorId
						AND (ci.cohort_id IS NULL OR ci.cohort_id = enrollment.cohort_id)
				))`,
				{ actorId: actor.id },
			);
		}

		if (query.courseId) {
			builder.andWhere('enrollment.courseId = :courseId', {
				courseId: query.courseId,
			});
		}
		if (query.userId && actor.role !== 'student') {
			builder.andWhere('enrollment.userId = :userId', { userId: query.userId });
		}
		if (query.status?.length) {
			builder.andWhere('enrollment.status IN (:...statuses)', {
				statuses: query.status,
			});
		}
		if (query.search) {
			builder.andWhere(
				`(LOWER(student.fullName) LIKE :search
					OR LOWER(student.email) LIKE :search
					OR LOWER(COALESCE(student.studentCode, '')) LIKE :search)`,
				{ search: `%${query.search.toLowerCase()}%` },
			);
		}

		const sortColumn =
			query.sortBy === 'progressPercent'
				? 'enrollment.progressPercent'
				: 'enrollment.enrolledAt';
		const [enrollments, total] = await builder
			.orderBy(sortColumn, query.order.toUpperCase() as 'ASC' | 'DESC')
			.addOrderBy('enrollment.id', 'ASC')
			.skip(toSkip(query.page, query.take))
			.take(query.take)
			.getManyAndCount();

		const counts = await this.loadLessonCounts(enrollments);

		return {
			items: enrollments.map((enrollment) =>
				this.toListItem(enrollment, counts),
			),
			meta: buildPageMeta(total, query.page, query.take),
		};
	}

	async findOne(id: string, actor: AuthUser): Promise<EnrollmentListItem> {
		const enrollment = await this.findEnrollmentOrFail(id);
		await this.assertCanView(enrollment, actor);
		const counts = await this.loadLessonCounts([enrollment]);
		return this.toListItem(enrollment, counts);
	}

	async cancel(
		id: string,
		actor: AuthUser,
	): Promise<{ id: string; status: EnrollmentStatus; updatedAt: Date }> {
		const enrollment = await this.findEnrollmentOrFail(id);
		if (actor.role !== 'admin' && enrollment.userId !== actor.id) {
			throw new ForbiddenException(
				'Bạn chỉ có thể huỷ ghi danh của chính mình.',
			);
		}
		if (enrollment.status === 'dropped') {
			throw new ConflictException('Ghi danh này đã được huỷ.');
		}

		enrollment.status = 'dropped';
		enrollment.droppedAt = new Date();
		const saved = await this.enrollmentRepository.save(enrollment);
		return { id: saved.id, status: saved.status, updatedAt: saved.updatedAt };
	}

	async getProgress(id: string, actor: AuthUser): Promise<EnrollmentProgress> {
		const enrollment = await this.findEnrollmentOrFail(id);
		await this.assertCanView(enrollment, actor);
		return this.buildProgress(enrollment);
	}

	async getCourseProgress(
		courseId: string,
		actor: AuthUser,
		userId?: string,
	): Promise<CourseProgressSummary> {
		if (actor.role === 'student' && userId && userId !== actor.id) {
			throw new ForbiddenException(
				'Bạn chỉ có thể xem dữ liệu của chính mình.',
			);
		}
		const targetUserId = actor.role === 'student' ? actor.id : userId;
		if (!targetUserId) {
			throw new BadRequestException(
				'Vui lòng cung cấp mã học viên để xem tiến độ.',
			);
		}
		const enrollment = await this.enrollmentRepository.findOne({
			where: { courseId, userId: targetUserId, status: Not('dropped') },
		});
		if (!enrollment) {
			throw new NotFoundException('Bạn chưa ghi danh khoá học này.');
		}
		await this.assertCanView(enrollment, actor);
		const progress = await this.buildProgress(enrollment);
		return {
			courseId,
			progressPercent: progress.progressPercent,
			completedLessons: progress.completedLessons,
			totalLessons: progress.totalLessons,
			lastActivityAt: progress.lastActivityAt,
			resumeLessonId: progress.resumeLessonId,
		};
	}

	/**
	 * Đăng ký khoá học cho **chính** người đang gọi.
	 *
	 * Thứ tự kiểm tra cố ý: rẻ → đắt, và mọi nhánh từ chối đều trả **lỗi nghiệp vụ nói rõ lý do**
	 * (không phải `500`), vì DoD E4-T1 yêu cầu "đăng ký trùng trả lỗi nghiệp vụ rõ ràng".
	 */
	async enroll(
		actor: AuthUser,
		dto: CreateEnrollmentDto,
	): Promise<MyEnrollmentSummary> {
		const course = await this.courseRepository.findOne({
			where: { id: dto.courseId, deletedAt: IsNull() },
		});

		if (!course) {
			throw new NotFoundException(COURSE_MESSAGE.notFound(dto.courseId));
		}

		// Học viên chỉ đăng ký được khoá đã publish và không phải khoá riêng tư; giảng viên/admin
		// cũng đi qua đúng cửa này để không có đường tắt nào bỏ qua vòng đời nội dung.
		if (course.status !== 'published' || course.visibility === 'private') {
			throw new BadRequestException(COURSE_MESSAGE.enrollmentClosed);
		}

		if (!course.enrollmentOpen) {
			throw new BadRequestException(COURSE_MESSAGE.enrollmentClosed);
		}

		if (dto.cohortId) {
			const cohort = await this.cohortRepository.findOne({
				where: { id: dto.cohortId },
			});

			// Lớp phải thuộc đúng khoá đang đăng ký: nếu không, một học viên có thể tự gắn mình vào
			// lớp của khoá khác và làm sai toàn bộ phạm vi dữ liệu của giảng viên (E8).
			if (!cohort || cohort.courseId !== course.id) {
				throw new NotFoundException(
					COURSE_MESSAGE.cohortNotFound(dto.cohortId),
				);
			}
		}

		if (course.maxStudents !== null) {
			// Học viên đã huỷ ghi danh không chiếm chỗ.
			const enrolledCount = await this.enrollmentRepository.count({
				where: { courseId: course.id, status: Not('dropped') },
			});

			if (enrolledCount >= course.maxStudents) {
				throw new BadRequestException(COURSE_MESSAGE.enrollmentFull);
			}
		}

		const existing = await this.enrollmentRepository.findOne({
			where: { userId: actor.id, courseId: course.id },
		});

		if (existing) {
			// Ghi danh đã huỷ thì mở lại thay vì tạo dòng thứ hai — bảng có UNIQUE (user_id,
			// course_id) nên tạo dòng mới là bất khả thi, và mở lại giữ được lịch sử học.
			if (existing.status === 'dropped') {
				existing.status = 'active';
				existing.droppedAt = null;
				existing.cohortId = dto.cohortId ?? existing.cohortId;
				const reopened = await this.enrollmentRepository.save(existing);

				return this.toSummary(reopened);
			}

			throw new ConflictException(COURSE_MESSAGE.alreadyEnrolled);
		}

		// Điều kiện tiên quyết kiểm tra sau cùng vì đây là phép kiểm tra đắt nhất (join 3 bảng) và
		// là điều kiện duy nhất cần dữ liệu học tập của người gọi.
		await this.courseEligibilityService.assertEligible(course.id, actor.id);

		const enrollment = this.enrollmentRepository.create({
			userId: actor.id,
			courseId: course.id,
			cohortId: dto.cohortId ?? null,
			status: 'active',
			source: 'self',
			progressPercent: 0,
		});

		try {
			return this.toSummary(await this.enrollmentRepository.save(enrollment));
		} catch (error) {
			// Hai request ghi danh song song cùng vượt qua bước `findOne` ở trên; ràng buộc
			// UNIQUE (user_id, course_id) là chốt chặn cuối. Dịch mã lỗi Postgres thành cùng
			// thông điệp nghiệp vụ thay vì để lộ `500`.
			if (this.isUniqueViolation(error)) {
				throw new ConflictException(COURSE_MESSAGE.alreadyEnrolled);
			}

			throw error;
		}
	}

	private async findEnrollmentOrFail(id: string): Promise<Enrollment> {
		const enrollment = await this.enrollmentRepository.findOne({
			where: { id },
			relations: { course: true, user: true },
		});
		if (!enrollment || enrollment.course.deletedAt) {
			throw new NotFoundException(`Không tìm thấy ghi danh với ID ${id}.`);
		}
		return enrollment;
	}

	private async assertCanView(
		enrollment: Enrollment,
		actor: AuthUser,
	): Promise<void> {
		if (actor.role === 'admin') return;
		if (actor.role === 'student') {
			if (enrollment.userId !== actor.id) {
				throw new ForbiddenException(
					'Bạn chỉ có thể xem dữ liệu của chính mình.',
				);
			}
			return;
		}
		await this.courseAccess.assertCanManage(enrollment.courseId, actor);
	}

	private async loadLessonCounts(
		enrollments: Enrollment[],
	): Promise<
		Map<
			string,
			{ completed: number; total: number; resumeLessonId: string | null }
		>
	> {
		const counts = new Map<
			string,
			{ completed: number; total: number; resumeLessonId: string | null }
		>();
		if (enrollments.length === 0) return counts;

		const courseIds = [...new Set(enrollments.map((item) => item.courseId))];
		const enrollmentIds = enrollments.map((item) => item.id);
		const [lessonRows, publishedLessons, completedRows] = await Promise.all([
			this.lessonRepository
				.createQueryBuilder('lesson')
				.select('lesson.courseId', 'courseId')
				.addSelect('COUNT(lesson.id)', 'count')
				.where('lesson.courseId IN (:...courseIds)', { courseIds })
				.andWhere('lesson.isPublished = true')
				.andWhere('lesson.deletedAt IS NULL')
				.groupBy('lesson.courseId')
				.getRawMany<{ courseId: string; count: string }>(),
			this.lessonRepository
				.createQueryBuilder('lesson')
				.select('lesson.id', 'lessonId')
				.addSelect('lesson.courseId', 'courseId')
				.where('lesson.courseId IN (:...courseIds)', { courseIds })
				.andWhere('lesson.isPublished = true')
				.andWhere('lesson.deletedAt IS NULL')
				.orderBy('lesson.courseId', 'ASC')
				.addOrderBy('lesson.orderIndex', 'ASC')
				.addOrderBy('lesson.id', 'ASC')
				.getRawMany<{ lessonId: string; courseId: string }>(),
			this.progressRepository
				.createQueryBuilder('progress')
				.innerJoin(
					Lesson,
					'lesson',
					'lesson.id = progress.lesson_id AND lesson.is_published = true AND lesson.deleted_at IS NULL',
				)
				.select('progress.enrollmentId', 'enrollmentId')
				.addSelect('progress.lessonId', 'lessonId')
				.where('progress.enrollmentId IN (:...enrollmentIds)', {
					enrollmentIds,
				})
				.andWhere('progress.status = :status', { status: 'completed' })
				.getRawMany<{ enrollmentId: string; lessonId: string }>(),
		]);

		const totalByCourse = new Map(
			lessonRows.map((row) => [row.courseId, Number(row.count)]),
		);
		const completedLessonKeys = new Set(
			completedRows.map((row) => `${row.enrollmentId}:${row.lessonId}`),
		);
		for (const enrollment of enrollments) {
			const courseLessons = publishedLessons.filter(
				(lesson) => lesson.courseId === enrollment.courseId,
			);
			const completed = courseLessons.filter((lesson) =>
				completedLessonKeys.has(`${enrollment.id}:${lesson.lessonId}`),
			);
			counts.set(enrollment.id, {
				completed: completed.length,
				total: totalByCourse.get(enrollment.courseId) ?? 0,
				resumeLessonId:
					courseLessons.find(
						(lesson) =>
							!completedLessonKeys.has(`${enrollment.id}:${lesson.lessonId}`),
					)?.lessonId ?? null,
			});
		}
		return counts;
	}

	private toListItem(
		enrollment: Enrollment,
		counts: Map<
			string,
			{ completed: number; total: number; resumeLessonId: string | null }
		>,
	): EnrollmentListItem {
		const lessonCounts = counts.get(enrollment.id) ?? {
			completed: 0,
			total: 0,
			resumeLessonId: null,
		};
		const progressPercent = lessonCounts.total
			? Math.round((lessonCounts.completed / lessonCounts.total) * 10000) / 100
			: 0;
		const status =
			enrollment.status === 'dropped' || enrollment.status === 'expired'
				? enrollment.status
				: lessonCounts.total > 0 &&
					  lessonCounts.completed === lessonCounts.total
					? 'completed'
					: 'active';
		return {
			id: enrollment.id,
			courseId: enrollment.courseId,
			status,
			progressPercent,
			enrolledAt: enrollment.enrolledAt,
			completedAt: status === 'completed' ? enrollment.completedAt : null,
			course: {
				id: enrollment.course.id,
				code: enrollment.course.code,
				title: enrollment.course.title,
				summary: enrollment.course.summary,
			},
			student: {
				id: enrollment.user.id,
				fullName: enrollment.user.fullName,
				email: enrollment.user.email,
				studentCode: enrollment.user.studentCode,
			},
			completedLessons: lessonCounts.completed,
			totalLessons: lessonCounts.total,
			resumeLessonId: lessonCounts.resumeLessonId,
			lastActivityAt: enrollment.lastActivityAt,
		};
	}

	private async buildProgress(
		enrollment: Enrollment,
	): Promise<EnrollmentProgress> {
		const lessons = await this.lessonRepository
			.createQueryBuilder('lesson')
			.innerJoinAndSelect('lesson.section', 'section')
			.where('lesson.courseId = :courseId', { courseId: enrollment.courseId })
			.andWhere('lesson.isPublished = true')
			.andWhere('lesson.deletedAt IS NULL')
			.orderBy('section.orderIndex', 'ASC')
			.addOrderBy('lesson.orderIndex', 'ASC')
			.addOrderBy('lesson.id', 'ASC')
			.getMany();
		const progressRows = lessons.length
			? await this.progressRepository.find({
					where: {
						enrollmentId: enrollment.id,
						lessonId: In(lessons.map((lesson) => lesson.id)),
					},
				})
			: [];
		const progressByLesson = new Map(
			progressRows.map((item) => [item.lessonId, item]),
		);
		const sections = new Map<string, EnrollmentSectionProgress>();
		let resumeLessonId: string | null = null;
		let completedLessons = 0;

		for (const lesson of lessons) {
			let section = sections.get(lesson.sectionId);
			if (!section) {
				section = {
					sectionId: lesson.sectionId,
					title: lesson.section.title,
					completedLessons: 0,
					totalLessons: 0,
					lessons: [],
				};
				sections.set(lesson.sectionId, section);
			}
			section.totalLessons += 1;
			const progress = progressByLesson.get(lesson.id);
			const state = progress?.status ?? 'not_started';
			if (state === 'completed') {
				completedLessons += 1;
				section.completedLessons += 1;
			} else if (resumeLessonId === null) {
				resumeLessonId = lesson.id;
			}
			section.lessons.push({
				lessonId: lesson.id,
				title: lesson.title,
				state,
				completedAt: progress?.completedAt ?? null,
				timeSpentSeconds: progress?.timeSpentSeconds ?? 0,
			});
		}

		const totalLessons = lessons.length;
		const progressPercent = totalLessons
			? Math.round((completedLessons / totalLessons) * 10000) / 100
			: 0;
		enrollment.progressPercent = progressPercent;
		if (totalLessons > 0 && completedLessons === totalLessons) {
			enrollment.status = 'completed';
			enrollment.completedAt ??= new Date();
		} else if (enrollment.status === 'completed') {
			enrollment.status = 'active';
			enrollment.completedAt = null;
		}
		await this.enrollmentRepository.save(enrollment);

		return {
			enrollmentId: enrollment.id,
			courseId: enrollment.courseId,
			progressPercent,
			completedLessons,
			totalLessons,
			lastActivityAt: enrollment.lastActivityAt,
			resumeLessonId,
			sections: [...sections.values()],
		};
	}

	private toSummary(enrollment: Enrollment): MyEnrollmentSummary {
		return {
			id: enrollment.id,
			status: enrollment.status,
			progressPercent: Number(enrollment.progressPercent ?? 0),
			enrolledAt: enrollment.enrolledAt,
			completedAt: enrollment.completedAt,
		};
	}

	private isUniqueViolation(error: unknown): boolean {
		const driverError = (error as { driverError?: { code?: string } })
			?.driverError;

		return driverError?.code === '23505';
	}
}
