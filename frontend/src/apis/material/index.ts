import { queryMethod } from '@/config';
import type {
	DefaultResponseType,
	MaterialItem,
	PaginatedMaterials,
} from '@/types';

/**
 * Tầng gọi API học liệu (E3-T4).
 *
 * Học liệu là các tệp thật (slide, video, tài liệu) hoặc văn bản, xem `types/lesson.ts` để biết
 * vì sao chúng **không** nằm trong cột `lessons.type` như ví dụ JSON của `api-specification.md`.
 */

/** `GET /api/lessons/:id/materials` — sắp theo `orderIndex`, rồi `createdAt`. */
export const getMaterials = (
	lessonId: string,
): Promise<DefaultResponseType<PaginatedMaterials>> =>
	queryMethod.get(`/lessons/${lessonId}/materials`) as Promise<
		DefaultResponseType<PaginatedMaterials>
	>;

/**
 * `POST /api/lessons/:id/materials` — `multipart/form-data` với trường `file` (+ `title` tuỳ chọn).
 *
 * Cố ý **không** đặt `Content-Type` thủ công: trình duyệt/axios phải tự thêm `boundary`, nếu tự đặt
 * thì server không tách được các phần của form và trả `400`.
 *
 * Lỗi cần xử lý ở tầng trang: `413` khi tệp vượt `MAX_UPLOAD_SIZE_MB`, `415` khi sai định dạng.
 */
export const uploadMaterial = (
	lessonId: string,
	file: File,
	title?: string,
): Promise<DefaultResponseType<MaterialItem>> => {
	const formData = new FormData();
	formData.append('file', file);
	if (title) formData.append('title', title);

	return queryMethod.post(
		`/lessons/${lessonId}/materials`,
		formData,
	) as Promise<DefaultResponseType<MaterialItem>>;
};

/** `DELETE /api/materials/:id` — xoá bản ghi rồi xoá tệp trên đĩa (tệp thiếu không làm hỏng request). */
export const deleteMaterial = (
	id: string,
): Promise<DefaultResponseType<{ success: boolean }>> =>
	queryMethod.delete(`/materials/${id}`) as Promise<
		DefaultResponseType<{ success: boolean }>
	>;
