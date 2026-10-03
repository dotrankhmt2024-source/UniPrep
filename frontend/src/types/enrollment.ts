/**
 * Kiểu dữ liệu ghi danh & tiến độ (E3-T7 kéo tối thiểu từ E4-T1, đầy đủ ở E4).
 */

export type EnrollmentStatus = 'active' | 'completed' | 'dropped' | 'expired';

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
	active: 'Đang học',
	completed: 'Đã hoàn thành',
	dropped: 'Đã huỷ ghi danh',
	expired: 'Quá hạn',
};

/** Trạng thái ghi danh của **người đang gọi** với một khoá học. */
export interface MyEnrollmentSummary {
	id: string;
	status: EnrollmentStatus;
	progressPercent: number;
	enrolledAt: string;
	completedAt: string | null;
}

export interface CreateEnrollmentPayload {
	courseId: string;
	cohortId?: string | null;
}
