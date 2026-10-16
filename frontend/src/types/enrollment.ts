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

export interface EnrollmentListItem {
	id: string;
	courseId: string;
	status: EnrollmentStatus;
	progressPercent: number;
	enrolledAt: string;
	completedAt: string | null;
	course: { id: string; code: string; title: string; summary: string | null };
	student: {
		id: string;
		fullName: string;
		email: string;
		studentCode: string | null;
	};
	completedLessons: number;
	totalLessons: number;
	resumeLessonId: string | null;
	lastActivityAt: string | null;
}

export interface PaginatedEnrollments {
	items: EnrollmentListItem[];
	meta: {
		page: number;
		take: number;
		itemCount: number;
		pageCount: number;
		hasPreviousPage: boolean;
		hasNextPage: boolean;
	};
}

export interface EnrollmentLessonProgress {
	lessonId: string;
	title: string;
	state: 'not_started' | 'in_progress' | 'completed';
	completedAt: string | null;
	timeSpentSeconds: number;
}

export interface EnrollmentSectionProgress {
	sectionId: string;
	title: string;
	completedLessons: number;
	totalLessons: number;
	lessons: EnrollmentLessonProgress[];
}

export interface EnrollmentProgress {
	enrollmentId: string;
	courseId: string;
	progressPercent: number;
	completedLessons: number;
	totalLessons: number;
	lastActivityAt: string | null;
	resumeLessonId: string | null;
	sections: EnrollmentSectionProgress[];
}

export interface CourseProgressSummary {
	courseId: string;
	progressPercent: number;
	completedLessons: number;
	totalLessons: number;
	lastActivityAt: string | null;
	resumeLessonId: string | null;
}

export interface CompleteLessonResult {
	lessonId: string;
	enrollmentId: string;
	state: 'completed' | 'not_started';
	completedAt: string | null;
	progressPercent: number;
	createdLearningEventIds: string[];
}
