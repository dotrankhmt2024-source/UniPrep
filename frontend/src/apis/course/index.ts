import { queryMethod } from '@/config';
import type {
	AssignInstructorPayload,
	CohortItem,
	CohortList,
	CourseDetail,
	CourseInstructorItem,
	CourseInstructorList,
	CreateCohortPayload,
	CreateCoursePayload,
	DefaultResponseType,
	FindCoursesParams,
	PaginatedCourses,
	PrerequisiteList,
	PublishCoursePayload,
	SetPrerequisitesPayload,
	UpdateCohortPayload,
	UpdateCoursePayload,
} from '@/types';

/**
 * Tầng gọi API khoá học (E3-T1/T3/T5).
 *
 * Lưu ý về phạm vi: backend **không** trả kèm `sections` trong chi tiết khoá học (khác ví dụ JSON
 * của `api-specification.md`) — mục lục khoá học do `apis/lesson` lo (`getSections`, `getLessons`).
 * Tách như vậy để `CourseModule` và `LessonModule` không phụ thuộc vòng lẫn nhau.
 */

/** `GET /api/courses` — học viên chỉ thấy khoá đã publish; giảng viên thấy thêm khoá mình phụ trách. */
export const getCourses = (
	params: FindCoursesParams = {},
): Promise<DefaultResponseType<PaginatedCourses>> =>
	queryMethod.get('/courses', { params }) as Promise<
		DefaultResponseType<PaginatedCourses>
	>;

/** `GET /api/courses/:id` — kèm `eligibility` (nếu là học viên) và `myEnrollment`. */
export const getCourseById = (
	id: string,
): Promise<DefaultResponseType<CourseDetail>> =>
	queryMethod.get(`/courses/${id}`) as Promise<
		DefaultResponseType<CourseDetail>
	>;

/** `POST /api/courses` — `teacher`/`admin`; `status` luôn bắt đầu ở `draft`. */
export const createCourse = (
	payload: CreateCoursePayload,
): Promise<DefaultResponseType<CourseDetail>> =>
	queryMethod.post('/courses', payload) as Promise<
		DefaultResponseType<CourseDetail>
	>;

/** `PATCH /api/courses/:id` — chỉ giảng viên phụ trách hoặc admin. */
export const updateCourse = (
	id: string,
	payload: UpdateCoursePayload,
): Promise<DefaultResponseType<CourseDetail>> =>
	queryMethod.patch(`/courses/${id}`, payload) as Promise<
		DefaultResponseType<CourseDetail>
	>;

/** `DELETE /api/courses/:id` — xoá mềm; `409` khi đã có học viên ghi danh. */
export const deleteCourse = (
	id: string,
): Promise<DefaultResponseType<{ success: boolean }>> =>
	queryMethod.delete(`/courses/${id}`) as Promise<
		DefaultResponseType<{ success: boolean }>
	>;

/** `PATCH /api/courses/:id/publish` — `400` khi khoá chưa có bài học nào. */
export const publishCourse = (
	id: string,
	payload: PublishCoursePayload = {},
): Promise<
	DefaultResponseType<{
		id: string;
		status: string;
		updatedAt: string;
	}>
> =>
	queryMethod.patch(`/courses/${id}/publish`, payload) as Promise<
		DefaultResponseType<{ id: string; status: string; updatedAt: string }>
	>;

/** `PATCH /api/courses/:id/unpublish` — đưa về `draft` nhưng **giữ** ghi danh đã có. */
export const unpublishCourse = (
	id: string,
): Promise<
	DefaultResponseType<{
		id: string;
		status: string;
		updatedAt: string;
	}>
> =>
	queryMethod.patch(`/courses/${id}/unpublish`) as Promise<
		DefaultResponseType<{ id: string; status: string; updatedAt: string }>
	>;

/** `GET /api/courses/:id/instructors` */
export const getCourseInstructors = (
	id: string,
): Promise<DefaultResponseType<CourseInstructorList>> =>
	queryMethod.get(`/courses/${id}/instructors`) as Promise<
		DefaultResponseType<CourseInstructorList>
	>;

/** `POST /api/courses/:id/instructors` — phân công giảng viên/trợ giảng cho khoá (hoặc một lớp). */
export const assignInstructor = (
	id: string,
	payload: AssignInstructorPayload,
): Promise<DefaultResponseType<CourseInstructorItem>> =>
	queryMethod.post(`/courses/${id}/instructors`, payload) as Promise<
		DefaultResponseType<CourseInstructorItem>
	>;

/** `DELETE /api/courses/:id/instructors/:userId` — `400` với chủ sở hữu chính. */
export const removeInstructor = (
	id: string,
	userId: string,
): Promise<DefaultResponseType<{ success: boolean }>> =>
	queryMethod.delete(`/courses/${id}/instructors/${userId}`) as Promise<
		DefaultResponseType<{ success: boolean }>
	>;

/** `GET /api/courses/:id/cohorts` — lớp/nhóm học viên của khoá (E2-T3 chuyển sang E3). */
export const getCohorts = (
	id: string,
): Promise<DefaultResponseType<CohortList>> =>
	queryMethod.get(`/courses/${id}/cohorts`) as Promise<
		DefaultResponseType<CohortList>
	>;

/** `POST /api/courses/:id/cohorts` */
export const createCohort = (
	id: string,
	payload: CreateCohortPayload,
): Promise<DefaultResponseType<CohortItem>> =>
	queryMethod.post(`/courses/${id}/cohorts`, payload) as Promise<
		DefaultResponseType<CohortItem>
	>;

/** `PATCH /api/cohorts/:id` */
export const updateCohort = (
	cohortId: string,
	payload: UpdateCohortPayload,
): Promise<DefaultResponseType<CohortItem>> =>
	queryMethod.patch(`/cohorts/${cohortId}`, payload) as Promise<
		DefaultResponseType<CohortItem>
	>;

/** `DELETE /api/cohorts/:id` — ghi danh và phân công của lớp vẫn còn (FK `SET NULL`). */
export const deleteCohort = (
	cohortId: string,
): Promise<DefaultResponseType<{ success: boolean }>> =>
	queryMethod.delete(`/cohorts/${cohortId}`) as Promise<
		DefaultResponseType<{ success: boolean }>
	>;

/** `PUT /api/courses/:id/prerequisites` — thay **toàn bộ** danh sách điều kiện tiên quyết. */
export const setCoursePrerequisites = (
	id: string,
	payload: SetPrerequisitesPayload,
): Promise<DefaultResponseType<PrerequisiteList>> =>
	queryMethod.put(`/courses/${id}/prerequisites`, payload) as Promise<
		DefaultResponseType<PrerequisiteList>
	>;
