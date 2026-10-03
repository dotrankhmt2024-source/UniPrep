/**
 * Union type cho khoá học & ghi danh — xem `docs/02-specs/database-design.md`
 * §7.2, §7.3, §7.10.
 */

/** Trạng thái vòng đời nội dung, lưu ở cột `courses.status`. */
export type CourseStatus = 'draft' | 'published' | 'hidden' | 'archived';

export type CourseVisibility = 'public' | 'unlisted' | 'private';

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export type EnrollmentStatus = 'active' | 'completed' | 'dropped' | 'expired';

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
