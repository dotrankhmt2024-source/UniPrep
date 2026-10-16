/**
 * Union type cho telemetry hành vi — xem `docs/02-specs/database-design.md`
 * §7.4. Cột `learning_events.event_type` là `varchar` KHÔNG có CHECK: thêm loại
 * sự kiện mới chỉ cần sửa file này, không cần migration (§4.3).
 */

export type EventType =
	| 'login'
	| 'logout'
	| 'course_viewed'
	| 'course_enrolled'
	| 'lesson_started'
	| 'lesson_resumed'
	| 'lesson_completed'
	| 'material_viewed'
	| 'video_watched'
	| 'quiz_started'
	| 'quiz_submitted'
	| 'quiz_abandoned'
	| 'discussion_posted'
	| 'notification_opened';

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
	login: 'Đăng nhập',
	logout: 'Đăng xuất',
	course_viewed: 'Xem khoá học',
	course_enrolled: 'Ghi danh khoá học',
	lesson_started: 'Bắt đầu bài học',
	lesson_resumed: 'Học tiếp bài học',
	lesson_completed: 'Hoàn thành bài học',
	material_viewed: 'Xem học liệu',
	video_watched: 'Xem video',
	quiz_started: 'Bắt đầu làm bài',
	quiz_submitted: 'Nộp bài',
	quiz_abandoned: 'Bỏ dở bài làm',
	discussion_posted: 'Đăng thảo luận',
	notification_opened: 'Mở thông báo',
};
