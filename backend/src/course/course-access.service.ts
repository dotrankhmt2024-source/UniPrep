import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { Course } from './entities/course.entity';
import { CourseInstructor } from './entities/course-instructor.entity';
import { COURSE_MESSAGE } from './constants/course-message.constant';
import type { AuthUser } from '../auth/types/authenticated-user.type';

/**
 * Nguồn chân lý duy nhất cho câu hỏi "ai được xem / được sửa khoá học nào" (E3-T1).
 *
 * **Vì sao phải có lớp này thay vì `if` rải rác trong từng service:** cột `student`/`teacher`
 * trong ma trận RBAC (`api-specification.md` §6) không kiểm tra được bằng metadata của route —
 * nó phụ thuộc dữ liệu (`courses.owner_id`, `course_instructors`). Nếu mỗi service tự viết điều
 * kiện thì chỉ cần một chỗ quên là hở quyền, và không ai phát hiện khi review. Ở đây mọi module
 * nội dung (Course, Lesson) bắt buộc đi qua `assertCanView`/`assertCanManage`.
 *
 * **Định nghĩa "assigned" (đã chốt 2026-10-03):** một giảng viên phụ trách khoá học khi
 * `courses.owner_id = user.id` **hoặc** có dòng `course_instructors` với `user_id = user.id`.
 * `courses.owner_id` vẫn là chủ sở hữu chính (hiển thị ở catalog); `course_instructors` bổ sung
 * đồng giảng viên/trợ giảng. Một dòng `course_instructors.cohort_id` có giá trị nghĩa là giảng
 * viên chỉ phụ trách **lớp** đó — đến E3, quyền nội dung (sửa bài học) vẫn áp cho cả khoá vì
 * chương/bài học không thuộc riêng lớp nào; phạm vi theo lớp được dùng từ E8 khi lọc **dữ liệu
 * học viên**. Ghi chú này để E8 không phải suy đoán lại.
 */
@Injectable()
export class CourseAccessService {
	constructor(
		@InjectRepository(Course)
		private readonly courseRepository: Repository<Course>,
		@InjectRepository(CourseInstructor)
		private readonly courseInstructorRepository: Repository<CourseInstructor>,
	) {}

	/**
	 * Lấy khoá học chưa bị xoá mềm, hoặc ném `404`.
	 *
	 * `deleted_at` là cột thường (không phải `@DeleteDateColumn`) nên **mọi** truy vấn phải tự
	 * lọc — đặt phép lọc vào đúng một chỗ để không có service nào quên.
	 *
	 * `category`/`owner` được nạp kèm vì **mọi** nơi gọi đều dùng tới chúng khi dựng response
	 * (`toCourseListItem` đọc `course.owner.id`). Thiếu hai quan hệ này thì mapper ném
	 * `Cannot read properties of undefined (reading 'id')` — lỗi đã xảy ra thật ở lần chạy đầu của
	 * E3 vì `findMany` quên `leftJoinAndSelect` và hàm này quên `relations`.
	 */
	async findCourseOrFail(courseId: string): Promise<Course> {
		const course = await this.courseRepository.findOne({
			where: { id: courseId, deletedAt: IsNull() },
			relations: { category: true, owner: true },
		});

		if (!course) {
			throw new NotFoundException(COURSE_MESSAGE.notFound(courseId));
		}

		return course;
	}

	/** Có dòng phân công giảng viên cho khoá học này hay không (bất kể `cohort_id`). */
	async isAssignedInstructor(
		courseId: string,
		userId: string,
	): Promise<boolean> {
		const count = await this.courseInstructorRepository.count({
			where: { courseId, userId },
		});

		return count > 0;
	}

	/** `admin` luôn được; `teacher` phải là chủ sở hữu hoặc có dòng phân công. */
	async canManage(course: Course, actor: AuthUser): Promise<boolean> {
		if (actor.role === 'admin') return true;
		if (actor.role !== 'teacher') return false;
		if (course.ownerId === actor.id) return true;

		return this.isAssignedInstructor(course.id, actor.id);
	}

	/**
	 * Quyền sửa/xoá/publish nội dung. Trả về chính `Course` để nơi gọi không phải truy vấn lại.
	 */
	async assertCanManage(courseId: string, actor: AuthUser): Promise<Course> {
		const course = await this.findCourseOrFail(courseId);

		if (!(await this.canManage(course, actor))) {
			throw new ForbiddenException(COURSE_MESSAGE.notManageable);
		}

		return course;
	}

	/** Khoá `published` + không `private` thì mọi vai trò đã đăng nhập xem được. */
	canViewPublished(course: Course): boolean {
		return course.status === 'published' && course.visibility !== 'private';
	}

	async canView(course: Course, actor: AuthUser): Promise<boolean> {
		if (this.canViewPublished(course)) return true;

		return this.canManage(course, actor);
	}

	/**
	 * Quyền xem chi tiết khoá học.
	 *
	 * Trả `403` (không phải `404`) khi khoá tồn tại nhưng chưa publish — theo ma trận RBAC §6,
	 * học viên xem khoá `draft` là "✖". Dùng `404` cũng an toàn hơn về mặt không lộ sự tồn tại,
	 * nhưng khi đó FE không phân biệt được "chưa publish" với "gõ sai ID" và sẽ hiển thị sai
	 * thông báo.
	 */
	async assertCanView(courseId: string, actor: AuthUser): Promise<Course> {
		const course = await this.findCourseOrFail(courseId);

		if (!(await this.canView(course, actor))) {
			throw new ForbiddenException(COURSE_MESSAGE.notViewable);
		}

		return course;
	}

	/**
	 * Áp phạm vi hiển thị của `actor` lên một query khoá học — dùng cho `GET /api/courses`.
	 *
	 * `admin`: không thêm điều kiện (thấy tất cả, kể cả `draft`/`archived`).
	 * `teacher`: khoá đã publish **hoặc** khoá mình phụ trách (mọi trạng thái) — đúng cột
	 * "xem khoá draft/hidden: assigned" của §6.
	 * `student`: chỉ khoá `published` và không `private`.
	 *
	 * Dùng `EXISTS` thay vì `IN (subquery)`: Postgres tối ưu nửa nối tốt hơn và không phải kéo
	 * toàn bộ danh sách id về tầng ứng dụng.
	 */
	applyVisibilityScope(
		qb: SelectQueryBuilder<Course>,
		actor: AuthUser,
	): SelectQueryBuilder<Course> {
		if (actor.role === 'admin') return qb;

		// Lấy alias từ chính query builder thay vì hardcode `"course"`: nơi gọi được quyền đặt alias
		// nào cũng được, và SQL sinh ra vẫn đúng. Hardcode alias là lỗi chỉ lộ ra khi chạy thật.
		const alias = qb.alias;

		if (actor.role === 'teacher') {
			// Nhánh "đã publish" phải kèm `visibility <> 'private'`, giống hệt `canViewPublished`.
			// Thiếu điều kiện đó thì catalog của giảng viên **lộ** khoá `private` của người khác trong
			// khi `GET /api/courses/:id` lại trả `403` — danh sách và chi tiết bất đồng, đúng loại lỗi
			// mà lớp này sinh ra để chặn (phát hiện bằng kiểm thử đầu-cuối E3).
			qb.andWhere(
				`(("${alias}"."status" = 'published' AND "${alias}"."visibility" <> 'private')
					OR "${alias}"."owner_id" = :scopeUserId
					OR EXISTS (
						SELECT 1 FROM "course_instructors" "ci"
						WHERE "ci"."course_id" = "${alias}"."id" AND "ci"."user_id" = :scopeUserId
					))`,
				{ scopeUserId: actor.id },
			);

			return qb;
		}

		qb.andWhere(`"${alias}"."status" = 'published'`);
		qb.andWhere(`"${alias}"."visibility" <> 'private'`);

		return qb;
	}
}
