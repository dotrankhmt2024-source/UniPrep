import { queryMethod } from '@/config';
import type {
	CreateLessonPayload,
	CreateSectionPayload,
	DefaultResponseType,
	FindLessonsParams,
	LessonDetail,
	PaginatedLessons,
	PaginatedSections,
	ReorderPayload,
	SectionDetail,
	SectionListItem,
	UpdateLessonPayload,
	UpdateSectionPayload,
} from '@/types';

/**
 * Tầng gọi API chương & bài học (E3-T2).
 *
 * Cả hai endpoint `reorder` đều nhận danh sách **đầy đủ** theo thứ tự mới (không phải "dịch
 * chuyển một phần tử") — nhờ vậy trạng thái sau khi gọi là xác định, không có nửa vời.
 */

/** `GET /api/courses/:courseId/sections` — mục lục chương, kèm số bài học. */
export const getSections = (
	courseId: string,
	params: { page?: number; take?: number; search?: string } = {},
): Promise<DefaultResponseType<PaginatedSections>> =>
	queryMethod.get(`/courses/${courseId}/sections`, { params }) as Promise<
		DefaultResponseType<PaginatedSections>
	>;

/** `POST /api/courses/:courseId/sections` — `orderIndex` tự động = max + 1. */
export const createSection = (
	courseId: string,
	payload: CreateSectionPayload,
): Promise<DefaultResponseType<SectionListItem>> =>
	queryMethod.post(`/courses/${courseId}/sections`, payload) as Promise<
		DefaultResponseType<SectionListItem>
	>;

/** `GET /api/sections/:id` — kèm danh sách bài học (học viên chỉ thấy bài đã publish). */
export const getSectionById = (
	id: string,
): Promise<DefaultResponseType<SectionDetail>> =>
	queryMethod.get(`/sections/${id}`) as Promise<
		DefaultResponseType<SectionDetail>
	>;

/** `PATCH /api/sections/:id` */
export const updateSection = (
	id: string,
	payload: UpdateSectionPayload,
): Promise<DefaultResponseType<SectionListItem>> =>
	queryMethod.patch(`/sections/${id}`, payload) as Promise<
		DefaultResponseType<SectionListItem>
	>;

/** `DELETE /api/sections/:id` — `409` khi chương đã có bài nộp/tiến độ học tập. */
export const deleteSection = (
	id: string,
): Promise<DefaultResponseType<{ success: boolean }>> =>
	queryMethod.delete(`/sections/${id}`) as Promise<
		DefaultResponseType<{ success: boolean }>
	>;

/** `PATCH /api/courses/:courseId/sections/reorder` */
export const reorderSections = (
	courseId: string,
	payload: ReorderPayload,
): Promise<DefaultResponseType<{ updated: number }>> =>
	queryMethod.patch(
		`/courses/${courseId}/sections/reorder`,
		payload,
	) as Promise<DefaultResponseType<{ updated: number }>>;

/** `GET /api/courses/:courseId/lessons` — danh sách phẳng (mặc định sắp theo lộ trình). */
export const getLessons = (
	courseId: string,
	params: FindLessonsParams = {},
): Promise<DefaultResponseType<PaginatedLessons>> =>
	queryMethod.get(`/courses/${courseId}/lessons`, { params }) as Promise<
		DefaultResponseType<PaginatedLessons>
	>;

/** `POST /api/sections/:sectionId/lessons` — `slug` và `orderIndex` do backend sinh. */
export const createLesson = (
	sectionId: string,
	payload: CreateLessonPayload,
): Promise<DefaultResponseType<LessonDetail>> =>
	queryMethod.post(`/sections/${sectionId}/lessons`, payload) as Promise<
		DefaultResponseType<LessonDetail>
	>;

/** `GET /api/lessons/:id` — học viên phải đã ghi danh và bài phải đã publish. */
export const getLessonById = (
	id: string,
): Promise<DefaultResponseType<LessonDetail>> =>
	queryMethod.get(`/lessons/${id}`) as Promise<
		DefaultResponseType<LessonDetail>
	>;

/** `PATCH /api/lessons/:id` */
export const updateLesson = (
	id: string,
	payload: UpdateLessonPayload,
): Promise<DefaultResponseType<LessonDetail>> =>
	queryMethod.patch(`/lessons/${id}`, payload) as Promise<
		DefaultResponseType<LessonDetail>
	>;

/** `DELETE /api/lessons/:id` — xoá mềm; `409` khi bài đã có bài nộp hoặc tiến độ. */
export const deleteLesson = (
	id: string,
): Promise<DefaultResponseType<{ success: boolean }>> =>
	queryMethod.delete(`/lessons/${id}`) as Promise<
		DefaultResponseType<{ success: boolean }>
	>;

/** `PATCH /api/sections/:sectionId/lessons/reorder` */
export const reorderLessons = (
	sectionId: string,
	payload: ReorderPayload,
): Promise<DefaultResponseType<{ updated: number }>> =>
	queryMethod.patch(
		`/sections/${sectionId}/lessons/reorder`,
		payload,
	) as Promise<DefaultResponseType<{ updated: number }>>;

/** `PATCH /api/lessons/:id/publish` */
export const publishLesson = (
	id: string,
): Promise<
	DefaultResponseType<{
		id: string;
		isPublished: boolean;
		updatedAt: string;
	}>
> =>
	queryMethod.patch(`/lessons/${id}/publish`) as Promise<
		DefaultResponseType<{ id: string; isPublished: boolean; updatedAt: string }>
	>;

/** `PATCH /api/lessons/:id/hide` — ẩn bài nhưng **giữ** tiến độ đã ghi. */
export const hideLesson = (
	id: string,
): Promise<
	DefaultResponseType<{
		id: string;
		isPublished: boolean;
		updatedAt: string;
	}>
> =>
	queryMethod.patch(`/lessons/${id}/hide`) as Promise<
		DefaultResponseType<{ id: string; isPublished: boolean; updatedAt: string }>
	>;
