import type { BadgeStatus } from '@/components';
import type {
	CourseLevel,
	CoursePublishStatus,
	EnrollmentStatus,
	LearnerCourseStatus,
	MaterialType,
} from '@/types';

/**
 * Ánh xạ trạng thái/loại của khoá học & học liệu sang tông màu `Badge` của design system, và vài
 * hàm định dạng dùng chung.
 *
 * Vì sao tách khỏi trang: trang catalog (E3-T6), trang chi tiết khoá (E3-T7) và khu soạn thảo của
 * giảng viên (E3-T9) cùng hiển thị trạng thái khoá học — màu phải giống nhau ở cả ba nơi. Chữ hiển
 * thị vẫn lấy từ `*_LABEL` trong `@/types`; file này chỉ quyết định **màu** và **định dạng số**.
 */

const PUBLISH_STATUS_TONE: Record<CoursePublishStatus, BadgeStatus> = {
	published: 'success',
	draft: 'warning',
	hidden: 'neutral',
	archived: 'neutral',
};

const LEARNER_STATUS_TONE: Record<LearnerCourseStatus, BadgeStatus> = {
	'in-progress': 'processing',
	future: 'info',
	past: 'neutral',
};

const MATERIAL_TYPE_TONE: Record<MaterialType, BadgeStatus> = {
	video: 'processing',
	slide: 'info',
	file: 'neutral',
	text: 'neutral',
	link: 'info',
};

const ENROLLMENT_STATUS_TONE: Record<EnrollmentStatus, BadgeStatus> = {
	active: 'success',
	completed: 'info',
	dropped: 'neutral',
	expired: 'error',
};

export const getCourseStatusBadgeTone = (
	status: CoursePublishStatus,
): BadgeStatus => PUBLISH_STATUS_TONE[status];

export const getLearnerStatusBadgeTone = (
	status: LearnerCourseStatus,
): BadgeStatus => LEARNER_STATUS_TONE[status];

export const getMaterialTypeBadgeTone = (type: MaterialType): BadgeStatus =>
	MATERIAL_TYPE_TONE[type];

export const getEnrollmentStatusBadgeTone = (
	status: EnrollmentStatus,
): BadgeStatus => ENROLLMENT_STATUS_TONE[status];

export const COURSE_LEVEL_TONE: Record<CourseLevel, BadgeStatus> = {
	beginner: 'success',
	intermediate: 'warning',
	advanced: 'error',
};

/** `24.5` → `'24,5 giờ'`; dùng cho `estimatedHours` (numeric của Postgres trả về number). */
export const formatEstimatedHours = (hours: number | null): string =>
	hours === null ? '—' : `${hours.toFixed(1).replace('.', ',')} giờ`;

/** `2456789` → `'2,3 MB'`. */
export const formatFileSize = (bytes: number | null): string => {
	if (bytes === null) return '—';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024)
		return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;

	return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
};

/** `720` → `'12 phút'`; dùng cho `durationSeconds` của học liệu video. */
export const formatDuration = (seconds: number | null): string => {
	if (seconds === null) return '—';
	const minutes = Math.round(seconds / 60);

	return minutes < 60
		? `${minutes} phút`
		: `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
};
