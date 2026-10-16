import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { CoursePrerequisite } from './entities/course-prerequisite.entity';
import { Enrollment } from './entities/enrollment.entity';
import { COURSE_MESSAGE } from './constants/course-message.constant';

/** Khoá học tiên quyết ở dạng rút gọn để trả về API và để hiển thị lý do. */
export interface PrerequisiteCourseRef {
	id: string;
	code: string;
	title: string;
	isSatisfied: boolean;
}

export interface CourseEligibility {
	eligible: boolean;
	reason: string | null;
	/** Khoá tiên quyết còn thiếu (rỗng khi `eligible = true`). */
	missing: PrerequisiteCourseRef[];
	prerequisites: PrerequisiteCourseRef[];
}

/**
 * Điều kiện tiên quyết của khoá học (E3-T5).
 *
 * **Quy tắc "đã đạt" (chốt 2026-10-03):** người học có dòng `enrollments` với
 * `status = 'completed'` cho khoá tiên quyết. Bảng `enrollments` đã có từ baseline E0 nên quy
 * tắc này chạy được ngay ở E3; khi `EnrollmentModule` (E4) hoàn thiện thì phần *ghi* trạng thái
 * `completed` mới có, còn phần *đọc* ở đây không đổi.
 *
 * **Vì sao tách khỏi `CourseService`:** cùng một phép kiểm tra được dùng ở hai nơi — trả cờ
 * `eligible` khi xem chi tiết khoá học, và **chặn** ở `POST /api/enrollments`. Nếu mỗi nơi tự
 * tính thì FE có thể thấy `eligible: true` nhưng API ghi danh lại từ chối.
 */
@Injectable()
export class CourseEligibilityService {
	constructor(
		@InjectRepository(CoursePrerequisite)
		private readonly prerequisiteRepository: Repository<CoursePrerequisite>,
		@InjectRepository(Course)
		private readonly courseRepository: Repository<Course>,
		@InjectRepository(Enrollment)
		private readonly enrollmentRepository: Repository<Enrollment>,
	) {}

	/** Danh sách khoá tiên quyết kèm trạng thái đã đạt của `userId` (hoặc chưa xét nếu userId null). */
	async listPrerequisites(
		courseId: string,
		userId?: string,
	): Promise<PrerequisiteCourseRef[]> {
		const rows = await this.prerequisiteRepository.find({
			where: { courseId },
			order: { createdAt: 'ASC' },
		});

		if (rows.length === 0) return [];

		const prerequisiteIds = rows.map((row) => row.prerequisiteCourseId);
		const courses = await this.courseRepository.find({
			where: { id: In(prerequisiteIds) },
		});
		const courseById = new Map(courses.map((course) => [course.id, course]));

		let satisfiedIds = new Set<string>();

		if (userId) {
			const completed = await this.enrollmentRepository.find({
				where: {
					userId,
					courseId: In(prerequisiteIds),
					status: 'completed',
				},
			});
			satisfiedIds = new Set(completed.map((row) => row.courseId));
		}

		return prerequisiteIds
			.map((id) => courseById.get(id))
			.filter((course): course is Course => !!course)
			.map((course) => ({
				id: course.id,
				code: course.code,
				title: course.title,
				isSatisfied: satisfiedIds.has(course.id),
			}));
	}

	async evaluate(courseId: string, userId: string): Promise<CourseEligibility> {
		const prerequisites = await this.listPrerequisites(courseId, userId);
		const missing = prerequisites.filter((item) => !item.isSatisfied);

		return {
			eligible: missing.length === 0,
			reason:
				missing.length === 0
					? null
					: COURSE_MESSAGE.prerequisiteMissing(
							missing.map((item) => `${item.code} — ${item.title}`),
						),
			missing,
			prerequisites,
		};
	}

	/** Dùng ở đường ghi (`POST /api/enrollments`): không đạt thì `400` kèm lý do cụ thể. */
	async assertEligible(courseId: string, userId: string): Promise<void> {
		const { eligible, reason } = await this.evaluate(courseId, userId);

		if (!eligible) {
			throw new BadRequestException(reason);
		}
	}

	/**
	 * Thay toàn bộ danh sách tiên quyết bằng `courseIds` (thao tác thay thế, không phải thêm/bớt
	 * từng dòng) — nhờ vậy FE gửi một lần là trạng thái cuối cùng xác định, không có nửa vời.
	 *
	 * **Tự tham chiếu là `400`, không phải lọc im lặng:** trước đây hàm bỏ qua id trùng với chính
	 * khoá học, khiến `PUT` với `courseIds: [chính nó]` trả `200` kèm danh sách **rỗng** — người gọi
	 * tưởng đã đặt được tiên quyết, còn thông điệp `prerequisiteSelf` thì không bao giờ dùng tới. Từ
	 * chối tường minh để sai sót của client hiện ra ngay (và DB vẫn có `chk_course_prerequisites_not_self`
	 * làm chốt chặn cuối).
	 */
	async replacePrerequisites(
		courseId: string,
		courseIds: string[],
	): Promise<PrerequisiteCourseRef[]> {
		if (courseIds.includes(courseId)) {
			throw new BadRequestException(COURSE_MESSAGE.prerequisiteSelf);
		}

		const uniqueIds = [...new Set(courseIds)];
		const rows: CoursePrerequisite[] = [];

		for (const prerequisiteCourseId of uniqueIds) {
			const course = await this.courseRepository.findOne({
				where: { id: prerequisiteCourseId },
			});

			if (!course) {
				throw new BadRequestException(
					COURSE_MESSAGE.prerequisiteNotFound(prerequisiteCourseId),
				);
			}

			rows.push(
				this.prerequisiteRepository.create({ courseId, prerequisiteCourseId }),
			);
		}

		await this.prerequisiteRepository.delete({ courseId });

		if (rows.length > 0) {
			await this.prerequisiteRepository.save(rows);
		}

		return this.listPrerequisites(courseId);
	}
}
