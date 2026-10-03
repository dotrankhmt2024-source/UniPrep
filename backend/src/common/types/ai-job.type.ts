/**
 * Union type cho job AI — xem `docs/02-specs/database-design.md` §7.9.
 */

export type AIJobType =
	| 'risk_prediction_single'
	| 'risk_prediction_batch'
	| 'explanation_generation'
	| 'analytics_aggregation';

export type AIJobStatus =
	'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export const AI_JOB_TYPE_LABEL: Record<AIJobType, string> = {
	risk_prediction_single: 'Dự đoán rủi ro một học viên',
	risk_prediction_batch: 'Dự đoán rủi ro theo lô',
	explanation_generation: 'Sinh giải thích',
	analytics_aggregation: 'Tổng hợp số liệu',
};

export const AI_JOB_STATUS_LABEL: Record<AIJobStatus, string> = {
	queued: 'Đang chờ',
	running: 'Đang chạy',
	succeeded: 'Thành công',
	failed: 'Thất bại',
	cancelled: 'Đã huỷ',
};
