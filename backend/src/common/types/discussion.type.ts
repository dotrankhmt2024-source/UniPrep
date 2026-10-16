/**
 * Union type cho thảo luận & báo cáo vi phạm — xem
 * `docs/02-specs/database-design.md` §3.3.10, §7.10.
 */

export type ContentReportTargetType =
	| 'discussion_thread'
	| 'discussion_post'
	| 'lesson'
	| 'lesson_material'
	| 'course';

export type ContentReportStatus =
	'pending' | 'reviewing' | 'resolved' | 'rejected';

export type ContentReportReason =
	| 'spam'
	| 'harassment'
	| 'inappropriate'
	| 'copyright'
	| 'misinformation'
	| 'other';

export const CONTENT_REPORT_TARGET_TYPE_LABEL: Record<
	ContentReportTargetType,
	string
> = {
	discussion_thread: 'Chủ đề thảo luận',
	discussion_post: 'Bài viết thảo luận',
	lesson: 'Bài học',
	lesson_material: 'Học liệu',
	course: 'Khoá học',
};

export const CONTENT_REPORT_STATUS_LABEL: Record<ContentReportStatus, string> =
	{
		pending: 'Chờ xử lý',
		reviewing: 'Đang xem xét',
		resolved: 'Đã xử lý',
		rejected: 'Bị từ chối',
	};

export const CONTENT_REPORT_REASON_LABEL: Record<ContentReportReason, string> =
	{
		spam: 'Spam',
		harassment: 'Quấy rối',
		inappropriate: 'Nội dung không phù hợp',
		copyright: 'Vi phạm bản quyền',
		misinformation: 'Thông tin sai lệch',
		other: 'Khác',
	};
