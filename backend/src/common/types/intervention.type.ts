/**
 * Union type cho can thiệp — xem `docs/02-specs/database-design.md` §7.9.
 */

export type InterventionType =
	| 'in_app_message'
	| 'email_reminder'
	| 'recommended_lesson'
	| 'mentor_assignment'
	| 'manual_note';

export type InterventionStatus =
	'draft' | 'sent' | 'acknowledged' | 'completed' | 'cancelled';

export const INTERVENTION_TYPE_LABEL: Record<InterventionType, string> = {
	in_app_message: 'Nhắn tin trong ứng dụng',
	email_reminder: 'Nhắc qua email',
	recommended_lesson: 'Gợi ý bài cần xem lại',
	mentor_assignment: 'Gán người kèm cặp',
	manual_note: 'Ghi chú nội bộ',
};

export const INTERVENTION_STATUS_LABEL: Record<InterventionStatus, string> = {
	draft: 'Bản nháp',
	sent: 'Đã gửi',
	acknowledged: 'Học viên đã xem',
	completed: 'Đã xử lý xong',
	cancelled: 'Đã huỷ',
};
