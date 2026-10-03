import {
	NOTIFICATION_CHANNEL_LABEL,
	NotificationChannel,
} from './notification.type';

/**
 * Union type cho các cột "tập mở" mà database-design.md có liệt kê giá trị
 * nhưng KHÔNG đặt CHECK ở DB (khác `role`/`status` của `users` hay `risk_level`).
 *
 * Vì sao vẫn khai báo union: TS là nguồn chân lý cho tập giá trị, DTO validate
 * ở tầng controller, và DB không cần migration mỗi lần thêm giá trị mới — đúng
 * lập luận của database-design.md §4.3.
 */

/** `interventions.outcome` (§3.5.1). */
export type InterventionOutcome =
	'improved' | 'no_change' | 'worsened' | 'unknown';

export const INTERVENTION_OUTCOME_LABEL: Record<InterventionOutcome, string> = {
	improved: 'Tiến bộ',
	no_change: 'Không đổi',
	worsened: 'Xấu đi',
	unknown: 'Chưa xác định',
};

/** `notifications.related_type` — tham chiếu đa hình, không có FK (§4.5). */
export type NotificationRelatedType =
	'intervention' | 'risk_prediction' | 'lesson' | 'quiz';

export const NOTIFICATION_RELATED_TYPE_LABEL: Record<
	NotificationRelatedType,
	string
> = {
	intervention: 'Can thiệp',
	risk_prediction: 'Dự đoán rủi ro',
	lesson: 'Bài học',
	quiz: 'Bài kiểm tra',
};

/** `alert_settings.scope` (§3.5.3). */
export type AlertScope = 'global' | 'course';

export const ALERT_SCOPE_LABEL: Record<AlertScope, string> = {
	global: 'Toàn hệ thống',
	course: 'Theo khoá học',
};

/** `audit_logs.status` (§3.5.4). */
export type AuditLogStatus = 'success' | 'failure';

export const AUDIT_LOG_STATUS_LABEL: Record<AuditLogStatus, string> = {
	success: 'Thành công',
	failure: 'Thất bại',
};

/**
 * `refresh_tokens.revoked_reason` (§3.1.2) — bảng liệt kê 4 giá trị nhưng không
 * ghi CHECK; vẫn giữ union để service không ghi giá trị lạ.
 */
export type RefreshTokenRevokedReason =
	'logout' | 'rotated' | 'reuse_detected' | 'admin_revoke';

export const REFRESH_TOKEN_REVOKED_REASON_LABEL: Record<
	RefreshTokenRevokedReason,
	string
> = {
	logout: 'Đăng xuất',
	rotated: 'Đã xoay token',
	reuse_detected: 'Phát hiện dùng lại token cũ',
	admin_revoke: 'Quản trị viên thu hồi',
};

/**
 * `interventions.channel` — cùng tập giá trị với kênh thông báo (§3.5.1).
 * Lưu ý: api-specification.md dòng 125 chỉ ghi `in_app | email`; DB và mục §3.5.1
 * có thêm `websocket`, nên ở đây theo DB (3 giá trị).
 */
export type InterventionChannel = NotificationChannel;

export const INTERVENTION_CHANNEL_LABEL: Record<InterventionChannel, string> =
	NOTIFICATION_CHANNEL_LABEL;
