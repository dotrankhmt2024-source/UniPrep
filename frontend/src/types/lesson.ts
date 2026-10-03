/**
 * Kiểu dữ liệu chương, bài học và học liệu (E3-T2/T4).
 *
 * **Mâu thuẫn đã chốt (2026-10-03):** ví dụ JSON trong `api-specification.md` giả định
 * `lessons.type`/`videoUrl`/`durationSeconds`, nhưng `database-design.md` §3.2.6/§3.2.7 và §7.7 lại
 * đặt video/slide/tệp vào `lesson_materials` (`material_type`, `url`, `duration_seconds`) và **không**
 * có cột `type` trên `lessons`. Nhóm chọn **database-design thắng** — nên ở đây bài học có
 * `content` + `materials[]`, và `derivedType` chỉ là field **suy diễn** cho tiện hiển thị
 * (FE không được ghi ngược giá trị này xuống server).
 */

import type { ReorderPayload } from './course';

export type MaterialType = 'text' | 'slide' | 'video' | 'file' | 'link';

export const MATERIAL_TYPE_LABEL: Record<MaterialType, string> = {
	text: 'Văn bản',
	slide: 'Slide bài giảng',
	video: 'Video',
	file: 'Tệp đính kèm',
	link: 'Liên kết',
};

/** Định dạng của `lessons.content` — repo dùng TipTap nên thực tế luôn là `html`. */
export type ContentFormat = 'markdown' | 'html' | 'tiptap_json';

export const CONTENT_FORMAT_LABEL: Record<ContentFormat, string> = {
	markdown: 'Markdown',
	html: 'HTML (TipTap)',
	tiptap_json: 'TipTap JSON',
};

/** Loại bài học suy diễn từ học liệu — chỉ để chọn biểu tượng/nhãn ở giao diện. */
export type LessonDerivedType = 'text' | 'video' | 'slide' | 'file';

export const LESSON_DERIVED_TYPE_LABEL: Record<LessonDerivedType, string> = {
	text: 'Bài đọc',
	video: 'Video',
	slide: 'Slide',
	file: 'Tệp',
};

export interface SectionListItem {
	id: string;
	courseId: string;
	title: string;
	description: string | null;
	orderIndex: number;
	isPublished: boolean;
	publishedAt: string | null;
	lessonCount: number;
}

export interface LessonListItem {
	id: string;
	sectionId: string;
	courseId: string;
	title: string;
	slug: string;
	summary: string | null;
	orderIndex: number;
	estimatedMinutes: number | null;
	isPublished: boolean;
	publishedAt: string | null;
	availableFrom: string | null;
	dueAt: string | null;
	derivedType: LessonDerivedType;
	materialCount: number;
}

export interface MaterialItem {
	id: string;
	lessonId: string;
	title: string;
	materialType: MaterialType;
	url: string | null;
	content: string | null;
	mimeType: string | null;
	fileSizeBytes: number | null;
	durationSeconds: number | null;
	orderIndex: number;
	isPublished: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface LessonDetail extends LessonListItem {
	content: string | null;
	contentFormat: ContentFormat;
	section: { id: string; title: string; orderIndex: number };
	materials: MaterialItem[];
}

export interface SectionDetail extends SectionListItem {
	lessons: LessonListItem[];
}

export interface PaginatedSections {
	items: SectionListItem[];
	meta: {
		page: number;
		take: number;
		itemCount: number;
		pageCount: number;
		hasPreviousPage: boolean;
		hasNextPage: boolean;
	};
}

export interface PaginatedLessons {
	items: LessonListItem[];
	meta: PaginatedSections['meta'];
}

export interface PaginatedMaterials {
	items: MaterialItem[];
	meta: PaginatedSections['meta'];
}

export interface MaterialList {
	items: MaterialItem[];
}

export const LESSON_SORT_FIELDS = ['orderIndex', 'createdAt', 'title'] as const;
export type LessonSortField = (typeof LESSON_SORT_FIELDS)[number];

export interface FindLessonsParams {
	page?: number;
	take?: number;
	search?: string;
	order?: 'asc' | 'desc';
	sortBy?: LessonSortField;
	sectionId?: string;
	isPublished?: boolean;
}

export interface CreateSectionPayload {
	title: string;
	description?: string | null;
	isPublished?: boolean;
}

export type UpdateSectionPayload = Partial<CreateSectionPayload>;

export interface CreateLessonPayload {
	title: string;
	summary?: string | null;
	content?: string | null;
	contentFormat?: ContentFormat;
	estimatedMinutes?: number | null;
	availableFrom?: string | null;
	dueAt?: string | null;
	isPublished?: boolean;
}

/**
 * `PATCH /api/lessons/:id`.
 *
 * **Không có `slug`:** trước đây type này khai `slug?: string` nhưng `UpdateLessonDto` của backend
 * không nhận trường đó, và `whitelist: true` của `ValidationPipe` **âm thầm** gỡ bỏ nó — tức FE gửi
 * lên, backend bỏ qua, không ai báo lỗi. Slug do backend sinh từ `title` (và sinh lại khi tiêu đề
 * đổi) nên client không được đặt. Bỏ hẳn trường khỏi type để không ai dùng lại.
 */
export type UpdateLessonPayload = Partial<CreateLessonPayload> & {
	sectionId?: string;
};

/** `POST /api/lessons/:id/materials` gửi `multipart/form-data`. */
export interface UploadMaterialPayload {
	file: File;
	title?: string;
}

export type { ReorderPayload };
