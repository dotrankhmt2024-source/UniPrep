/**
 * Kiểu dữ liệu cho module "khoá học".
 *
 * **Đổi tên quan trọng (E3, database-design §7.2):** repo trước E3 dùng `CourseStatus` cho
 * `'in-progress' | 'future' | 'past'` — đó là *trạng thái của khoá học theo góc nhìn một học viên*,
 * **không** phải cột `courses.status` trong DB. Khi nối API thật, hai khái niệm này chạm nhau nên
 * được tách tên:
 * - `CoursePublishStatus` ↔ cột `courses.status` (`draft`/`published`/`hidden`/`archived`).
 * - `LearnerCourseStatus` ↔ trạng thái suy diễn từ `enrollments` + lịch của lớp (E4).
 *
 * Tên field bám **database-design** (nguồn chân lý của schema), không bám ví dụ JSON trong
 * `api-specification.md`: API trả `title`/`summary`/`owner`/`coverUrl` chứ không phải
 * `name`/`teacherId`/`thumbnailUrl` (đã chốt 2026-10-03).
 */

import type { MyEnrollmentSummary } from './enrollment';

export type CoursePublishStatus = 'draft' | 'published' | 'hidden' | 'archived';

export const COURSE_PUBLISH_STATUS_LABEL: Record<CoursePublishStatus, string> =
	{
		draft: 'Bản nháp',
		published: 'Đã xuất bản',
		hidden: 'Đang ẩn',
		archived: 'Đã lưu trữ',
	};

export type CourseVisibility = 'public' | 'unlisted' | 'private';

export const COURSE_VISIBILITY_LABEL: Record<CourseVisibility, string> = {
	public: 'Công khai',
	unlisted: 'Không niêm yết',
	private: 'Riêng tư',
};

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export const COURSE_LEVEL_LABEL: Record<CourseLevel, string> = {
	beginner: 'Cơ bản',
	intermediate: 'Trung cấp',
	advanced: 'Nâng cao',
};

export type CourseInstructorRole = 'owner' | 'co_instructor' | 'assistant';

export const COURSE_INSTRUCTOR_ROLE_LABEL: Record<
	CourseInstructorRole,
	string
> = {
	owner: 'Phụ trách chính',
	co_instructor: 'Đồng giảng viên',
	assistant: 'Trợ giảng',
};

/** Trạng thái khoá học theo góc nhìn học viên — suy diễn ở FE từ `enrollments` (E4). */
export type LearnerCourseStatus = 'in-progress' | 'future' | 'past';

export const LEARNER_COURSE_STATUS_LABEL: Record<LearnerCourseStatus, string> =
	{
		'in-progress': 'Đang học',
		future: 'Sắp tới',
		past: 'Đã kết thúc',
	};

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

export interface Category extends CategorySummary {
	description: string | null;
	parentId: string | null;
	orderIndex: number;
	isActive: boolean;
	courseCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface CourseListItem {
	id: string;
	code: string;
	title: string;
	slug: string;
	summary: string | null;
	status: CoursePublishStatus;
	visibility: CourseVisibility;
	level: CourseLevel | null;
	semester: string | null;
	coverUrl: string | null;
	category: CategorySummary | null;
	owner: UserSummary;
	sectionCount: number;
	lessonCount: number;
	enrolledCount: number;
	myEnrollment: MyEnrollmentSummary | null;
	createdAt: string;
	updatedAt: string;
}

export interface CourseInstructorItem {
	id: string;
	userId: string;
	fullName: string;
	email: string;
	roleInCourse: CourseInstructorRole;
	cohortId: string | null;
	cohortName: string | null;
	assignedAt: string;
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
	memberCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface PrerequisiteCourseRef {
	id: string;
	code: string;
	title: string;
	isSatisfied: boolean;
}

export interface CourseEligibility {
	eligible: boolean;
	reason: string | null;
	missing: PrerequisiteCourseRef[];
	prerequisites: PrerequisiteCourseRef[];
}

export interface CourseDetail extends CourseListItem {
	description: string | null;
	language: string;
	estimatedHours: number | null;
	enrollmentOpen: boolean;
	maxStudents: number | null;
	publishedAt: string | null;
	prerequisites: PrerequisiteCourseRef[];
	/** `null` với `teacher`/`admin` — chỉ học viên mới có khái niệm "đủ điều kiện ghi danh". */
	eligibility: CourseEligibility | null;
	instructors: CourseInstructorItem[];
}

export interface PaginatedCourses {
	items: CourseListItem[];
	meta: {
		page: number;
		take: number;
		itemCount: number;
		pageCount: number;
		hasPreviousPage: boolean;
		hasNextPage: boolean;
	};
}

export interface PaginatedCategories {
	items: Category[];
	meta: PaginatedCourses['meta'];
}

export interface CohortList {
	items: CohortItem[];
}

export interface CourseInstructorList {
	items: CourseInstructorItem[];
}

export interface PrerequisiteList {
	items: PrerequisiteCourseRef[];
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

export interface FindCoursesParams {
	page?: number;
	take?: number;
	search?: string;
	order?: 'asc' | 'desc';
	sortBy?: CourseSortField;
	categoryId?: string;
	/** Backend nhận danh sách phân tách bằng dấu phẩy. */
	status?: string;
	semester?: string;
	ownerId?: string;
	level?: CourseLevel;
}

export interface FindCategoriesParams {
	page?: number;
	take?: number;
	search?: string;
	order?: 'asc' | 'desc';
	sortBy?: CategorySortField;
}

export interface CreateCategoryPayload {
	name: string;
	slug?: string;
	description?: string | null;
	parentId?: string | null;
	orderIndex?: number;
	isActive?: boolean;
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export interface CreateCoursePayload {
	code: string;
	title: string;
	summary?: string | null;
	description?: string | null;
	categoryId?: string | null;
	/** Chỉ admin gửi được; giảng viên gửi sẽ bị bỏ qua và trở thành chủ sở hữu. */
	ownerId?: string;
	coverUrl?: string | null;
	level?: CourseLevel | null;
	language?: string;
	semester?: string | null;
	visibility?: CourseVisibility;
	estimatedHours?: number | null;
	enrollmentOpen?: boolean;
	maxStudents?: number | null;
}

export type UpdateCoursePayload = Partial<
	Omit<CreateCoursePayload, 'ownerId'>
> & {
	ownerId?: string;
};

export interface PublishCoursePayload {
	/** `true` = công bố luôn toàn bộ chương và bài học chưa publish của khoá. */
	publishLessons?: boolean;
}

export interface CreateCohortPayload {
	name: string;
	groupCode?: string | null;
	classCode?: string | null;
	semester?: string | null;
	startsOn?: string | null;
	endsOn?: string | null;
}

export type UpdateCohortPayload = Partial<CreateCohortPayload>;

export interface AssignInstructorPayload {
	userId: string;
	roleInCourse?: CourseInstructorRole;
	cohortId?: string | null;
}

export interface SetPrerequisitesPayload {
	courseIds: string[];
}

/** Payload dùng chung cho mọi endpoint `reorder` (chương, bài học). */
export interface ReorderPayload {
	items: { id: string; orderIndex: number }[];
}
