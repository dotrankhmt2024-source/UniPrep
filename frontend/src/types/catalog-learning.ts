import type { EnrollmentStatus } from './enrollment';

/** Một môn trong Catalog (DB đề cương của trường) kèm trạng thái của người học trong UniPrep. */
export interface LearnerCatalogCourse {
	courseCode: string;
	latestVersion: string;
	name: { vi: string | null; en: string | null };
	credits: number | null;
	facultyCode: string | null;
	/** Khoá học UniPrep đã được mở từ môn này; `null` = chưa ai mở. */
	course: { id: string; catalogRef: string } | null;
	myEnrollment: { id: string; status: EnrollmentStatus } | null;
}

export interface FindCatalogCoursesParams {
	page?: number;
	take?: number;
	search?: string;
	faculty?: string;
}

/** Một bài trong bảng chọn phạm vi quiz theo tiến độ. */
export interface QuizScopeLesson {
	id: string;
	title: string;
	completed: boolean;
	hasContent: boolean;
}

export interface QuizScopeSection {
	id: string;
	title: string;
	orderIndex: number;
	lessons: QuizScopeLesson[];
}

export interface QuizScope {
	course: { id: string; code: string; title: string };
	sections: QuizScopeSection[];
	totalLessons: number;
	completedLessons: number;
}
