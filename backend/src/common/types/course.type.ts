/**
 * Union type cho khoá học & ghi danh — xem `docs/02-specs/database-design.md`
 * §7.2, §7.3, §7.10.
 */

/** Trạng thái vòng đời nội dung, lưu ở cột `courses.status`. */
export type CourseStatus = 'draft' | 'published' | 'hidden' | 'archived';

/**
 * Bản runtime của các union ở trên — cần cho `@IsIn()` của class-validator và cho việc tách
 * tham số query dạng `?status=published,draft`. Giữ cùng thứ tự với union để đọc là đối chiếu được;
 * `satisfies` bảo đảm không lệch khi union thay đổi.
 */
export const COURSE_STATUS_VALUES = [
	'draft',
	'published',
	'hidden',
	'archived',
] as const satisfies readonly CourseStatus[];

export type CourseVisibility = 'public' | 'unlisted' | 'private';

export const COURSE_VISIBILITY_VALUES = [
	'public',
	'unlisted',
	'private',
] as const satisfies readonly CourseVisibility[];

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export const COURSE_LEVEL_VALUES = [
	'beginner',
	'intermediate',
	'advanced',
] as const satisfies readonly CourseLevel[];

export type EnrollmentStatus = 'active' | 'completed' | 'dropped' | 'expired';

/**
 * Vai trò của một giảng viên trong khoá học (`course_instructors.role_in_course`,
 * database-design §3.2.3).
 *
 * `owner` = chủ sở hữu chính (trùng `courses.owner_id` khi dòng được tạo tự động),
 * `co_instructor` = đồng giảng viên có toàn quyền nội dung,
 * `assistant` = trợ giảng — hiện có cùng quyền nội dung, tách ra để E8/E10 giới hạn quyền
 * xem dữ liệu học viên nếu cần.
 */
export type CourseInstructorRole = 'owner' | 'co_instructor' | 'assistant';

export const COURSE_INSTRUCTOR_ROLE_LABEL: Record<
	CourseInstructorRole,
	string
> = {
	owner: 'Phụ trách chính',
	co_instructor: 'Đồng giảng viên',
	assistant: 'Trợ giảng',
};

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
	draft: 'Bản nháp',
	published: 'Đã xuất bản',
	hidden: 'Đang ẩn',
	archived: 'Đã lưu trữ',
};

export const COURSE_VISIBILITY_LABEL: Record<CourseVisibility, string> = {
	public: 'Công khai',
	unlisted: 'Không niêm yết',
	private: 'Riêng tư',
};

export const COURSE_LEVEL_LABEL: Record<CourseLevel, string> = {
	beginner: 'Cơ bản',
	intermediate: 'Trung cấp',
	advanced: 'Nâng cao',
};

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
	active: 'Đang học',
	completed: 'Đã hoàn thành',
	dropped: 'Đã huỷ ghi danh',
	expired: 'Quá hạn',
};
