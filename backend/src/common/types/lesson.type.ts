/**
 * Union type cho bài học & học liệu — xem `docs/02-specs/database-design.md`
 * §7.3, §7.6.
 */

export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed';

export type MaterialType = 'text' | 'slide' | 'video' | 'file' | 'link';

export const LESSON_PROGRESS_STATUS_LABEL: Record<
	LessonProgressStatus,
	string
> = {
	not_started: 'Chưa bắt đầu',
	in_progress: 'Đang học',
	completed: 'Đã hoàn thành',
};

export const MATERIAL_TYPE_LABEL: Record<MaterialType, string> = {
	text: 'Văn bản',
	slide: 'Slide bài giảng',
	video: 'Video',
	file: 'Tệp đính kèm',
	link: 'Liên kết',
};
