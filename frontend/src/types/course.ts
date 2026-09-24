/**
 * Kiểu dữ liệu cho module "khoá học".
 * Hiện tại dữ liệu lấy từ `src/mocks/course.ts`; khi backend xong chỉ cần thay nguồn
 * trong `apis/course` mà không phải sửa page.
 */

export type CourseStatus = 'in-progress' | 'future' | 'past';

export type CourseModuleType = 'video' | 'file' | 'quiz' | 'forum' | 'assign' | 'url';

export interface CourseModule {
	id: string;
	name: string;
	type: CourseModuleType;
	/** Ghi chú ngắn hiển thị dưới tên, ví dụ "Đã xem 12/20 phút". */
	meta?: string;
}

export interface CourseSection {
	id: string;
	name: string;
	/** Section đang được nhấn mạnh (Moodle: "Đã được nhấn mạnh"). */
	highlighted?: boolean;
	modules: CourseModule[];
}

export interface Course {
	/** Tên tắt của khoá học, dùng làm route param và rowKey. */
	id: string;
	code: string;
	name: string;
	teacher: string;
	/** Học kỳ dạng hiển thị, ví dụ "1/2026-2027". */
	semester: string;
	/** Danh mục / khoa quản lý khoá học. */
	category: string;
	/** Nhóm lớp, ví dụ "CQ_HK261". */
	group: string;
	/** Danh sách lớp, ví dụ "[L01,L05,L07]". */
	classes: string;
	status: CourseStatus;
	starred: boolean;
	sections: CourseSection[];
}

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
	'in-progress': 'Đang học',
	future: 'Sắp tới',
	past: 'Đã kết thúc',
};
