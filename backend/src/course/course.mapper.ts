import type { Category } from './entities/category.entity';
import type { Cohort } from './entities/cohort.entity';
import type { CourseInstructor } from './entities/course-instructor.entity';
import type { Course } from './entities/course.entity';
import type { Enrollment } from './entities/enrollment.entity';
import type {
	CategoryItem,
	CategorySummary,
	CohortItem,
	CourseInstructorItem,
	CourseDetail,
	CourseListItem,
	MyEnrollmentSummary,
	UserSummary,
} from './types/course.type';

/**
 * Chuyển entity → hình dạng API của `CourseModule` (E3-T1/T3/T5).
 *
 * **Vì sao liệt kê tường minh từng trường thay vì spread entity:** đây là hàng rào duy nhất giữ
 * các cột nội bộ (`courses.deleted_at`, `created_by`, `archived_at`…) khỏi response. Nếu trả
 * thẳng entity thì mỗi cột mới thêm sau này tự động lọt ra API mà không ai review — cùng lý do
 * `user.mapper.ts` không spread `User`.
 *
 * `sectionCount`/`lessonCount`/`enrolledCount`/`myEnrollment` **không** suy ra được từ entity: phải
 * truyền vào theo lô (xem `CourseService.loadListItems`). Đó cũng là lý do các mapper nhận tham số
 * thứ hai là một "phần bổ sung" chứ không đọc quan hệ của entity (quan hệ chưa được nạp).
 */

/** Dữ liệu đếm/ghi danh đã nạp theo lô cho một khoá học. */
export interface CourseListExtras {
	sectionCount: number;
	lessonCount: number;
	enrolledCount: number;
	myEnrollment: MyEnrollmentSummary | null;
}

export const toCategorySummary = (
	category: Category | null,
): CategorySummary | null =>
	category
		? { id: category.id, name: category.name, slug: category.slug }
		: null;

export const toUserSummary = (owner: {
	id: string;
	fullName: string;
	email: string;
}): UserSummary => ({
	id: owner.id,
	fullName: owner.fullName,
	email: owner.email,
});

export const toCategoryItem = (
	category: Category,
	courseCount: number,
): CategoryItem => ({
	id: category.id,
	name: category.name,
	slug: category.slug,
	description: category.description,
	parentId: category.parentId,
	orderIndex: category.orderIndex,
	isActive: category.isActive,
	courseCount,
	createdAt: category.createdAt,
	updatedAt: category.updatedAt,
});

export const toMyEnrollmentSummary = (
	enrollment: Enrollment,
): MyEnrollmentSummary => ({
	id: enrollment.id,
	status: enrollment.status,
	progressPercent: enrollment.progressPercent,
	enrolledAt: enrollment.enrolledAt,
	completedAt: enrollment.completedAt,
});

export const toCourseListItem = (
	course: Course,
	extras: CourseListExtras,
): CourseListItem => ({
	id: course.id,
	code: course.code,
	title: course.title,
	slug: course.slug,
	summary: course.summary,
	status: course.status,
	visibility: course.visibility,
	level: course.level,
	semester: course.semester,
	coverUrl: course.coverUrl,
	category: toCategorySummary(course.category ?? null),
	owner: toUserSummary(course.owner),
	sectionCount: extras.sectionCount,
	lessonCount: extras.lessonCount,
	enrolledCount: extras.enrolledCount,
	myEnrollment: extras.myEnrollment,
	createdAt: course.createdAt,
	updatedAt: course.updatedAt,
});

/**
 * Chi tiết = dòng danh sách + phần thân đầy đủ + giảng viên + tiên quyết.
 *
 * `eligibility` **không** được tính ở đây: nó phụ thuộc người gọi (`student` hay không) nên
 * `CourseService` truyền vào tường minh, tránh việc mapper tự đoán vai trò.
 */
export const toCourseDetail = (
	course: Course,
	extras: CourseListExtras,
	detail: {
		prerequisites: CourseDetail['prerequisites'];
		instructors: CourseInstructorItem[];
		eligibility: CourseDetail['eligibility'];
	},
): CourseDetail => ({
	...toCourseListItem(course, extras),
	description: course.description,
	language: course.language,
	estimatedHours: course.estimatedHours,
	enrollmentOpen: course.enrollmentOpen,
	maxStudents: course.maxStudents,
	publishedAt: course.publishedAt,
	prerequisites: detail.prerequisites,
	eligibility: detail.eligibility,
	instructors: detail.instructors,
});

/** Một dòng `course_instructors` đã join `users` (và `cohorts` nếu có phạm vi lớp). */
export const toCourseInstructorItem = (row: {
	instructor: CourseInstructor;
	user: { fullName: string; email: string } | null;
	cohort: { name: string } | null;
}): CourseInstructorItem => ({
	id: row.instructor.id,
	userId: row.instructor.userId,
	fullName: row.user?.fullName ?? '',
	email: row.user?.email ?? '',
	roleInCourse: row.instructor.roleInCourse,
	cohortId: row.instructor.cohortId,
	cohortName: row.cohort?.name ?? null,
	assignedAt: row.instructor.assignedAt,
});

/** Một dòng `cohorts` kèm số học viên đã gắn (đếm theo lô ở service). */
export const toCohortItem = (
	cohort: Cohort,
	memberCount: number,
): CohortItem => ({
	id: cohort.id,
	courseId: cohort.courseId,
	groupCode: cohort.groupCode,
	classCode: cohort.classCode,
	name: cohort.name,
	semester: cohort.semester,
	startsOn: cohort.startsOn,
	endsOn: cohort.endsOn,
	memberCount,
	createdAt: cohort.createdAt,
	updatedAt: cohort.updatedAt,
});
