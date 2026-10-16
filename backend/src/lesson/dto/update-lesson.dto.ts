import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateLessonDto } from './create-lesson.dto';

/**
 * `PATCH /api/lessons/:id` (E3-T2) — mọi trường tuỳ chọn, chỉ ghi khoá nào client thực sự gửi.
 *
 * `sectionId` cho phép **di chuyển bài sang chương khác trong cùng khoá học**; service kiểm tra
 * `course_id` của chương đích, vì đổi khoá học là thao tác khác hẳn (đổi cả ngữ cảnh ghi danh,
 * quiz và tiến độ) và không nằm trong phạm vi E3-T2.
 *
 * `slug` **không** có trong DTO: slug sinh từ `title`. Client muốn giữ slug cũ chỉ cần không gửi
 * `title`; muốn đổi thì gửi `title` và slug được sinh lại (xem `LessonService.update`).
 */
export class UpdateLessonDto extends PartialType(CreateLessonDto) {
	@ApiPropertyOptional({
		format: 'uuid',
		description: 'Chuyển bài học sang chương khác **trong cùng khoá học**.',
	})
	@IsOptional()
	@IsUUID('4', { message: 'ID chương không hợp lệ.' })
	sectionId?: string;
}
