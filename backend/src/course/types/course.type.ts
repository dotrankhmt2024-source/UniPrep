import type { PageMeta } from '../../common/dto/page-meta.dto';
import type {
	CourseLevel,
	CourseStatus,
	CourseVisibility,
} from '../../common/types';
import type { CourseInstructorRole } from '../../common/types';
import type {
	CourseEligibility,
	PrerequisiteCourseRef,
} from '../course-eligibility.service';

/**
 * Kiểu dữ liệu trả về của `CourseModule` (E3-T1/T3/T5).
 *
 * Quy ước: DB lưu `snake_case`, API trả `camelCase`; union type khai ở `common/types` rồi
 * re-export ở đây để FE và e2e chỉ phải nhìn một chỗ.
 */

export interface CategorySummary {
	id: string;
	name: string;
	slug: string;
}

export interface UserSummary {
	id: string;
	fullName: string;
	email: string;
}

export interface CategoryItem {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	parentId: string | null;
	orderIndex: number;
	isActive: boolean;
	/** Số khoá học (chưa xoá mềm) đang thuộc danh mục này. */
	courseCount: number;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Trạng thái ghi danh của **người đang gọi** đối với khoá học — `null` khi chưa ghi danh.
 * Có mặt ở cả danh sách lẫn chi tiết để catalog hiển thị "Đã đăng ký" mà không phải gọi thêm API.
 */
export interface MyEnrollmentSummary {
	id: string;
	status: string;
	progressPercent: number;
	enrolledAt: Date;
	completedAt: Date | null;
}

export interface EnrollmentListItem extends MyEnrollmentSummary {
	courseId: string;
	course: { id: string; code: string; title: string; summary: string | null };
	student: {
		id: string;
		fullName: string;
		email: string;
		studentCode: string | null;
	};
	completedLessons: number;
	totalLessons: number;
	resumeLessonId: string | null;
	lastActivityAt: Date | null;
}

export interface EnrollmentLessonProgress {
	lessonId: string;
	title: string;
	state: 'not_started' | 'in_progress' | 'completed';
	completedAt: Date | null;
	timeSpentSeconds: number;
}

export interface EnrollmentSectionProgress {
	sectionId: string;
	title: string;
	completedLessons: number;
	totalLessons: number;
	lessons: EnrollmentLessonProgress[];
}

export interface EnrollmentProgress {
	enrollmentId: string;
	courseId: string;
	progressPercent: number;
	completedLessons: number;
	totalLessons: number;
	lastActivityAt: Date | null;
	resumeLessonId: string | null;
	sections: EnrollmentSectionProgress[];
}

export interface CourseProgressSummary {
	courseId: string;
	progressPercent: number;
	completedLessons: number;
	totalLessons: number;
	lastActivityAt: Date | null;
	resumeLessonId: string | null;
}

export interface CourseListItem {
	id: string;
	code: string;
	title: string;
	slug: string;
	summary: string | null;
	status: CourseStatus;
	visibility: CourseVisibility;
	level: CourseLevel | null;
	semester: string | null;
	coverUrl: string | null;
	category: CategorySummary | null;
	/** Chủ sở hữu chính (`courses.owner_id`). */
	owner: UserSummary;
	sectionCount: number;
	lessonCount: number;
	enrolledCount: number;
	myEnrollment: MyEnrollmentSummary | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CourseInstructorItem {
	id: string;
	userId: string;
	fullName: string;
	email: string;
	roleInCourse: CourseInstructorRole;
	/** `null` = phụ trách cả khoá. */
	cohortId: string | null;
	cohortName: string | null;
	assignedAt: Date;
}

export interface CohortItem {
	id: string;
	courseId: string;
	groupCode: string | null;
	classCode: string | null;
	name: string;
	semester: string | null;
	startsOn: string | null;
	endsOn: string | null;
	/** Số học viên đang gắn vào lớp (`enrollments.cohort_id`). */
	memberCount: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface CourseDetail extends CourseListItem {
	description: string | null;
	language: string;
	estimatedHours: number | null;
	enrollmentOpen: boolean;
	maxStudents: number | null;
	publishedAt: Date | null;
	prerequisites: PrerequisiteCourseRef[];
	/**
	 * `null` với `teacher`/`admin` (họ không "đăng ký" khoá học) và với người chưa đăng nhập;
	 * với `student` luôn có giá trị — kể cả khi đủ điều kiện (`eligible: true`).
	 */
	eligibility: CourseEligibility | null;
	instructors: CourseInstructorItem[];
}

export interface PaginatedCategories {
	items: CategoryItem[];
	meta: PageMeta;
}

export interface PaginatedCourses {
	items: CourseListItem[];
	meta: PageMeta;
}

export interface CohortList {
	items: CohortItem[];
}

export const COURSE_SORT_FIELDS = [
	'createdAt',
	'title',
	'code',
	'enrolledCount',
] as const;
export type CourseSortField = (typeof COURSE_SORT_FIELDS)[number];

export const CATEGORY_SORT_FIELDS = ['name', 'createdAt'] as const;
export type CategorySortField = (typeof CATEGORY_SORT_FIELDS)[number];
