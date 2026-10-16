import type { LessonMaterial } from './entities/lesson-material.entity';
import type { Lesson } from './entities/lesson.entity';
import type { CourseSection } from '../course/entities/course-section.entity';
import type {
	LessonDerivedType,
	LessonDetail,
	LessonListItem,
	MaterialItem,
	SectionDetail,
	SectionListItem,
} from './types/lesson.type';

/**
 * Chuyển entity → hình dạng HTTP của `LessonModule`.
 *
 * Cùng lý do như `user.mapper.ts`: nhiều endpoint trả **cùng** một hình dạng (chương xuất hiện ở
 * danh sách, ở chi tiết và ở response của `POST`), nên trường được **liệt kê tường minh** ở một chỗ.
 * Nếu mỗi service tự map thì việc thêm một cột nội bộ (ví dụ `deleted_at`) sẽ lộ ra API ở nơi bị quên.
 *
 * `derivedType`/`materialCount` **không** đọc từ entity mà do service truyền vào: cả hai đều đến từ
 * truy vấn gộp trên `lesson_materials`, không phải cột của `lessons`.
 */

/** Kết quả truy vấn gộp học liệu theo bài học (một dòng cho mỗi bài có học liệu). */
export interface MaterialAggregateRow {
	lessonId: string;
	materialType: string;
	materialCount: number | string;
}

export interface LessonMaterialStats {
	derivedType: LessonDerivedType;
	materialCount: number;
}

/**
 * Suy ra `derivedType` từ thống kê học liệu.
 *
 * Thứ tự ưu tiên video > slide > file > text đã chốt trong báo cáo E3: một bài vừa có video vừa có
 * slide được hiển thị là "video" vì đó là nội dung chính học viên phải xem. Bài không có học liệu
 * nào (hoặc chỉ có `text`/`link`) là `text` — vẫn là bài đọc được nhờ `lessons.content`.
 */
export const toLessonMaterialStats = (
	rows: MaterialAggregateRow[],
): Map<string, LessonMaterialStats> => {
	const stats = new Map<string, LessonMaterialStats>();

	for (const row of rows) {
		const current = stats.get(row.lessonId) ?? {
			derivedType: 'text' as LessonDerivedType,
			materialCount: 0,
		};

		// `COUNT(*)` trả `bigint` ⇒ driver `pg` đưa về **string**, phải ép số trước khi cộng
		// (cùng cái bẫy đã ghi ở `LessonMaterial.fileSizeBytes`, §8.7 của database-design).
		current.materialCount += Number(row.materialCount);
		current.derivedType = preferDerivedType(
			current.derivedType,
			row.materialType,
		);
		stats.set(row.lessonId, current);
	}

	return stats;
};

export const toSectionListItem = (
	section: CourseSection,
	lessonCount = 0,
): SectionListItem => ({
	id: section.id,
	courseId: section.courseId,
	title: section.title,
	description: section.description,
	orderIndex: section.orderIndex,
	isPublished: section.isPublished,
	publishedAt: section.publishedAt,
	lessonCount,
});

export const toLessonListItem = (
	lesson: Lesson,
	stats: LessonMaterialStats = { derivedType: 'text', materialCount: 0 },
): LessonListItem => ({
	id: lesson.id,
	sectionId: lesson.sectionId,
	courseId: lesson.courseId,
	title: lesson.title,
	slug: lesson.slug,
	summary: lesson.summary,
	orderIndex: lesson.orderIndex,
	estimatedMinutes: lesson.estimatedMinutes,
	isPublished: lesson.isPublished,
	publishedAt: lesson.publishedAt,
	dueAt: lesson.dueAt,
	availableFrom: lesson.availableFrom,
	derivedType: stats.derivedType,
	materialCount: stats.materialCount,
});

export const toLessonDetail = (
	lesson: Lesson,
	stats: LessonMaterialStats,
	materials: LessonMaterial[],
	section: CourseSection,
): LessonDetail => ({
	...toLessonListItem(lesson, stats),
	content: lesson.content,
	contentFormat: lesson.contentFormat,
	materials: materials.map(toMaterialItem),
	// Chỉ ba trường: FE cần breadcrumb "Chương N: tên" mà không phải gọi thêm API.
	section: {
		id: section.id,
		title: section.title,
		orderIndex: section.orderIndex,
	},
});

export const toSectionDetail = (
	section: CourseSection,
	lessonCount: number,
	lessons: LessonListItem[],
): SectionDetail => ({
	...toSectionListItem(section, lessonCount),
	lessons,
});

export const toMaterialItem = (material: LessonMaterial): MaterialItem => ({
	id: material.id,
	lessonId: material.lessonId,
	title: material.title,
	materialType: material.materialType,
	url: material.url,
	content: material.content,
	mimeType: material.mimeType,
	fileSizeBytes: material.fileSizeBytes,
	durationSeconds: material.durationSeconds,
	orderIndex: material.orderIndex,
	isPublished: material.isPublished,
	createdAt: material.createdAt,
	updatedAt: material.updatedAt,
});

/**
 * Chuẩn hoá tiêu đề thành slug: bỏ dấu tiếng Việt để URL đọc được (`Đề cương` → `de-cuong`).
 *
 * `NFD` + xoá khối dấu kết hợp (`\u0300-\u036f`) xử lý được cả `ă/â/ê/ô/ơ/ư` lẫn dấu thanh; `đ`
 * không tách được bằng Unicode nên phải thay tay. Slug dùng cho URL nên chỉ giữ `[a-z0-9-]`.
 *
 * Có thể trả chuỗi rỗng nếu tiêu đề không còn ký tự nào dùng được (ví dụ toàn dấu `!!!`); việc đặt
 * tên dự phòng và bảo đảm duy nhất thuộc `LessonService.generateUniqueSlug`.
 */
export const toSlug = (title: string): string => {
	const normalized = title
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/đ/g, 'd')
		.replace(/Đ/g, 'D')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return normalized;
};

/** `true` nếu `type` được ưu tiên hơn `current` trong thang video > slide > file > text. */
const preferDerivedType = (
	current: LessonDerivedType,
	type: string,
): LessonDerivedType => {
	if (type === 'video') return 'video';
	if (type === 'slide' && current !== 'video') return 'slide';
	if (type === 'file' && current === 'text') return 'file';

	return current;
};
