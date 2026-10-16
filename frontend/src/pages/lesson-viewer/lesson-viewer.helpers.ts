import { LESSON_DERIVED_TYPE_LABEL } from '@/types';
import type { LessonDetail, LessonListItem, SectionListItem } from '@/types';

/**
 * Tiện ích riêng của trang xem bài học (E3-T8).
 *
 * Tách khỏi `index.tsx` vì hai lý do: (1) giữ component trang chỉ còn luồng dữ liệu, (2) các hàm
 * thuần ở đây dễ suy luận và không phụ thuộc React.
 */

/** Câu hiển thị cho từng mã lỗi của `GET /api/lessons/:id`. */
export const LESSON_ERROR_MESSAGE: Record<number, string> = {
	403: 'Bạn cần đăng ký khoá học và bài học phải được công bố để xem nội dung.',
	404: 'Không tìm thấy bài học này. Có thể bài đã bị xoá hoặc đường dẫn không đúng.',
};

export const LESSON_NOT_FOUND_MESSAGE =
	'Không tìm thấy bài học này. Có thể bài đã bị xoá hoặc đường dẫn không đúng.';

/** Khoá của nhóm "bài học không thuộc chương nào" khi dữ liệu trả về thiếu `sectionId`. */
export const ORPHAN_LESSON_KEY = '__orphan__';

/** Một chương trong mục lục, kèm danh sách bài đã sắp theo `orderIndex`. */
export interface LessonOutlineItem {
	key: string;
	title: string;
	lessons: LessonListItem[];
}

/**
 * Thứ tự lộ trình: theo `orderIndex`, bằng nhau thì theo `title` để kết quả **xác định** (hai bài
 * cùng `orderIndex` không được đổi chỗ ngẫu nhiên giữa hai lần tải).
 */
export const sortByCourseOrder = <
	T extends { orderIndex: number; title: string },
>(
	items: T[],
): T[] =>
	[...items].sort(
		(a, b) => a.orderIndex - b.orderIndex || a.title.localeCompare(b.title),
	);

/**
 * Mục lục của trang: gộp bài học vào chương theo `sectionId`.
 *
 * Học viên nhận danh sách đã lọc `isPublished = true` từ backend, nhưng vẫn lọc lại ở đây: giảng
 * viên/admin gọi cùng endpoint sẽ nhận **cả** bài nháp, và hợp đồng của trang này là chỉ hiển thị
 * bài đã công bố.
 */
export const buildLessonOutline = (
	sections: SectionListItem[],
	lessons: LessonListItem[],
): LessonOutlineItem[] => {
	const publishedLessons = lessons.filter((lesson) => lesson.isPublished);
	const lessonsBySection = new Map<string, LessonListItem[]>();

	publishedLessons.forEach((lesson) => {
		// `sectionId` là `string` trong type nhưng dữ liệu có thể thiếu ở biên (JSON của BE);
		// rơi vào nhóm "khác" còn hơn làm sập cả trang.
		const key = lesson.sectionId || ORPHAN_LESSON_KEY;
		const bucket = lessonsBySection.get(key);
		if (bucket) bucket.push(lesson);
		else lessonsBySection.set(key, [lesson]);
	});

	const knownSectionIds = new Set(sections.map((section) => section.id));
	const orphanLessons = publishedLessons.filter(
		(lesson) => !lesson.sectionId || !knownSectionIds.has(lesson.sectionId),
	);

	const outline = sortByCourseOrder(sections).map((section) => ({
		key: section.id,
		title: section.title,
		lessons: sortByCourseOrder(lessonsBySection.get(section.id) ?? []),
	}));

	// Nhóm cuối chỉ xuất hiện khi dữ liệu thực sự lệch — nếu không có thì không thêm panel rỗng.
	if (orphanLessons.length > 0) {
		outline.push({
			key: ORPHAN_LESSON_KEY,
			title: 'Bài học khác',
			lessons: sortByCourseOrder(orphanLessons),
		});
	}

	return outline;
};

/** Danh sách bài đã công bố, đã sắp theo lộ trình — nguồn của "Bài x / y" và nút trước/sau. */
export const toPublishedLessonList = (
	lessons: LessonListItem[],
): LessonListItem[] =>
	sortByCourseOrder(lessons.filter((lesson) => lesson.isPublished));

/** Tên chương của một bài: ưu tiên `section.title` trong chi tiết, thiếu thì tra ở mục lục. */
export const resolveSectionTitle = (
	lesson: LessonDetail,
	outline: LessonOutlineItem[],
): string => {
	if (lesson.section?.title) return lesson.section.title;

	const panel = outline.find((item) => item.key === lesson.sectionId);

	// Chương không nằm trong trang đầu của `getSections` — vẫn nêu được bài thuộc một chương khác.
	return panel?.title ?? 'Chương khác';
};

/** `'video'` → `'Video'`; dùng cho nhãn `Badge` của từng bài trong mục lục. */
export const getDerivedTypeLabel = (lesson: LessonListItem): string =>
	LESSON_DERIVED_TYPE_LABEL[lesson.derivedType] ?? 'Bài học';

/** Mã HTTP của lỗi axios, hoặc `null` nếu lỗi không phải từ HTTP. */
export const getHttpStatus = (error: unknown): number | null => {
	if (typeof error !== 'object' || error === null) return null;

	const { response } = error as { response?: { status?: unknown } };
	const status = response?.status;

	return typeof status === 'number' ? status : null;
};
