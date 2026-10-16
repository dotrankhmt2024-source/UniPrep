/**
 * Union type cho thông báo — xem `docs/02-specs/database-design.md` §7.8.
 */

export type NotificationType =
	| 'risk_alert'
	| 'intervention_message'
	| 'deadline_reminder'
	| 'new_content'
	| 'grade_published'
	| 'system';

export type NotificationChannel = 'in_app' | 'email' | 'websocket';

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
	risk_alert: 'Cảnh báo nguy cơ chậm tiến độ',
	intervention_message: 'Tin nhắn từ giảng viên',
	deadline_reminder: 'Nhắc hạn hoàn thành',
	new_content: 'Nội dung mới',
	grade_published: 'Đã có điểm',
	system: 'Thông báo hệ thống',
};

export const NOTIFICATION_CHANNEL_LABEL: Record<NotificationChannel, string> = {
	in_app: 'Trong ứng dụng',
	email: 'Email',
	websocket: 'Thời gian thực',
};
