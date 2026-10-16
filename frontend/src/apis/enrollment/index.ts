import { queryMethod } from '@/config';
import type {
	CompleteLessonResult,
	CourseProgressSummary,
	CreateEnrollmentPayload,
	DefaultResponseType,
	EnrollmentListItem,
	EnrollmentProgress,
	MyEnrollmentSummary,
	PaginatedEnrollments,
} from '@/types';

/**
 * Tầng gọi API ghi danh — **lát cắt tối thiểu từ E4-T1** dùng cho nút đăng ký của E3-T7.
 *
 * E4 bổ sung danh sách, huỷ ghi danh và các luồng tiến độ vào cùng module.
 */

/** `POST /api/enrollments` — backend trả `400` nếu thiếu điều kiện tiên quyết, `409` nếu đã đăng ký. */
export const enrollCourse = (
	payload: CreateEnrollmentPayload,
): Promise<DefaultResponseType<MyEnrollmentSummary>> =>
	queryMethod.post('/enrollments', payload) as Promise<
		DefaultResponseType<MyEnrollmentSummary>
	>;

export const getMyEnrollments = (
	params: { page?: number; take?: number; status?: string } = {},
): Promise<DefaultResponseType<PaginatedEnrollments>> =>
	queryMethod.get('/enrollments', { params }) as Promise<
		DefaultResponseType<PaginatedEnrollments>
	>;

export const getEnrollmentById = (
	id: string,
): Promise<DefaultResponseType<EnrollmentListItem>> =>
	queryMethod.get(`/enrollments/${id}`) as Promise<
		DefaultResponseType<EnrollmentListItem>
	>;

export const cancelEnrollment = (
	id: string,
): Promise<
	DefaultResponseType<{ id: string; status: string; updatedAt: string }>
> =>
	queryMethod.delete(`/enrollments/${id}`) as Promise<
		DefaultResponseType<{ id: string; status: string; updatedAt: string }>
	>;

export const getEnrollmentProgress = (
	id: string,
): Promise<DefaultResponseType<EnrollmentProgress>> =>
	queryMethod.get(`/enrollments/${id}/progress`) as Promise<
		DefaultResponseType<EnrollmentProgress>
	>;

export const getCourseProgress = (
	courseId: string,
): Promise<DefaultResponseType<CourseProgressSummary>> =>
	queryMethod.get(`/courses/${courseId}/progress`) as Promise<
		DefaultResponseType<CourseProgressSummary>
	>;

export const completeLesson = (
	id: string,
	timeSpentSeconds = 0,
): Promise<DefaultResponseType<CompleteLessonResult>> =>
	queryMethod.post(`/lessons/${id}/complete`, { timeSpentSeconds }) as Promise<
		DefaultResponseType<CompleteLessonResult>
	>;

export const uncompleteLesson = (
	id: string,
): Promise<DefaultResponseType<CompleteLessonResult>> =>
	queryMethod.delete(`/lessons/${id}/complete`) as Promise<
		DefaultResponseType<CompleteLessonResult>
	>;
