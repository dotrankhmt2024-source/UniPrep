import type { PageMeta } from '../../common/dto/page-meta.dto';
import type { PageOrder } from '../../common/dto/pagination-query.dto';
import type { MaterialType } from '../../common/types';

/**
 * Kiểu dữ liệu HTTP của `LessonModule` (E3-T2 chương/bài học, E3-T4 học liệu).
 *
 * Bốn hình dạng là **có chủ đích**, không phải trùng lặp: danh sách phải nhẹ (bảng/lộ trình chỉ
 * cần vài trường), còn trang chi tiết mới trả `content` (có thể là text lớn) và `materials`.
 * Cùng lý do như `UserListItem`/`UserDetail` ở E2.
 */

export interface SectionListItem {
	id: string;
	courseId: string;
	title: string;
	description: string | null;
	orderIndex: number;
	isPublished: boolean;
	publishedAt: Date | null;
	/** Số bài học **chưa xoá mềm** trong chương; nạp bằng MỘT truy vấn gộp (không N+1). */
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
	publishedAt: Date | null;
	dueAt: Date | null;
	availableFrom: Date | null;
	/** Suy ra từ `lesson_materials` — xem `LessonDerivedType`. */
	derivedType: LessonDerivedType;
	/** Số học liệu của bài; nạp trong cùng truy vấn gộp với `derivedType`. */
	materialCount: number;
}

export interface LessonDetail extends LessonListItem {
	content: string | null;
	contentFormat: 'markdown' | 'html' | 'tiptap_json';
	materials: MaterialItem[];
	section: { id: string; title: string; orderIndex: number };
}

export interface SectionDetail extends SectionListItem {
	lessons: LessonListItem[];
}

/** `data` của `POST /api/lessons/:id/materials`, `GET /api/lessons/:id/materials`. */
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
	createdAt: Date;
	updatedAt: Date;
}

export interface PaginatedSections {
	items: SectionListItem[];
	meta: PageMeta;
}

export interface PaginatedLessons {
	items: LessonListItem[];
	meta: PageMeta;
}

export interface PaginatedMaterials {
	items: MaterialItem[];
	meta: PageMeta;
}

/**
 * Loại bài học **suy diễn** từ học liệu.
 *
 * Đây là cách xử lý xung đột đã được nhóm chốt: `api-specification.md` giả định bài học có
 * `type`/`video_url`/`duration_seconds`, còn `database-design.md` §3.2.6/§3.2.7 lại đặt toàn bộ nội
 * dung đa phương tiện trong `lesson_materials`. **`database-design` thắng** (schema mới hơn và đã
 * lên migration), nên `lesson_materials.material_type` là nguồn chân lý duy nhất; bảng `lessons`
 * **không** được thêm cột `type`/`video_url`/`duration_seconds`.
 */
export type LessonDerivedType = 'video' | 'slide' | 'file' | 'text';

export const LESSON_DERIVED_TYPE_LABEL: Record<LessonDerivedType, string> = {
	video: 'Video',
	slide: 'Slide',
	file: 'Tệp',
	text: 'Văn bản',
};

/**
 * Trường được phép sắp xếp. Danh sách **đóng** vì `sortBy` đi thẳng vào `ORDER BY` (TypeORM không
 * tham số hoá tên cột) — nhận chuỗi tự do từ query là lỗ hổng SQL injection, cùng lý do như
 * `USER_SORT_FIELDS` ở E2.
 */
export const LESSON_SORT_FIELDS = ['orderIndex', 'createdAt', 'title'] as const;
export type LessonSortField = (typeof LESSON_SORT_FIELDS)[number];

/** Bảng ánh xạ trường sắp xếp → cột thật (không nội suy chuỗi client vào SQL). */
export const LESSON_SORT_COLUMN: Record<LessonSortField, string> = {
	orderIndex: 'lesson.orderIndex',
	createdAt: 'lesson.createdAt',
	title: 'lesson.title',
};

/**
 * `order` mặc định của `GET /api/courses/:courseId/lessons` là **`asc`** (khác mặc định `desc` của
 * `PaginationQueryDto`): danh sách bài học là **lộ trình**, người học đọc từ bài 1 tới bài cuối. Trả
 * `desc` sẽ đảo ngược lộ trình và phá "bài kế tiếp" ở FE.
 *
 * Giá trị này được `FindLessonsQueryDto` khai lại làm mặc định của trường `order`; hằng số ở đây để
 * service/test có một nguồn chân lý thay vì mỗi nơi viết lại chuỗi `'asc'`.
 */
export const LESSON_DEFAULT_ORDER: PageOrder = 'asc';
