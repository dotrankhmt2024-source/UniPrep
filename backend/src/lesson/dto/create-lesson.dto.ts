import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsDateString,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';
import { trimString } from '../../common/transformers/trim.transformer';

/** Định dạng nội dung bài học — khớp CHECK `chk_lessons_content_format` của DB. */
export const LESSON_CONTENT_FORMATS = [
	'markdown',
	'html',
	'tiptap_json',
] as const;

export type LessonContentFormat = (typeof LESSON_CONTENT_FORMATS)[number];

/**
 * `POST /api/sections/:sectionId/lessons` (E3-T2).
 *
 * `content_format` mặc định `'html'` (theo brief E3-T2), **không** phải `'markdown'` — giá trị mặc
 * định của cột trong DB chỉ là lưới an toàn cho các luồng ghi cũ; editor của FE (TipTap) gửi HTML.
 *
 * `slug` **không** nhận từ client: nó được sinh từ `title` ở service để không có hai nguồn chân lý
 * cho URL bài học (và để tránh client đặt slug trùng/độc hại).
 */
export class CreateLessonDto {
	@ApiProperty({ minLength: 3, maxLength: 255, example: 'Bài 1: Giới thiệu' })
	@Transform(trimString)
	@IsString({ message: 'Tiêu đề bài học phải là chuỗi.' })
	@MinLength(3, { message: 'Tiêu đề bài học phải có ít nhất 3 ký tự.' })
	@MaxLength(255, { message: 'Tiêu đề bài học tối đa 255 ký tự.' })
	title!: string;

	@ApiPropertyOptional({ maxLength: 500 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Tóm tắt bài học phải là chuỗi.' })
	@MaxLength(500, { message: 'Tóm tắt bài học tối đa 500 ký tự.' })
	summary?: string;

	@ApiPropertyOptional({ description: 'Nội dung bài học (text lớn).' })
	@IsOptional()
	@IsString({ message: 'Nội dung bài học phải là chuỗi.' })
	content?: string;

	@ApiPropertyOptional({
		enum: LESSON_CONTENT_FORMATS,
		default: 'html',
	})
	@IsOptional()
	@IsIn(LESSON_CONTENT_FORMATS, {
		message: `Định dạng nội dung không hợp lệ (chỉ nhận: ${LESSON_CONTENT_FORMATS.join(', ')}).`,
	})
	contentFormat?: LessonContentFormat;

	@ApiPropertyOptional({ minimum: 0, example: 45 })
	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'Thời lượng dự kiến phải là số nguyên (phút).' })
	@Min(0, { message: 'Thời lượng dự kiến không được âm.' })
	estimatedMinutes?: number;

	@ApiPropertyOptional({ format: 'date-time' })
	@IsOptional()
	@IsDateString({}, { message: 'Thời điểm mở bài học phải là chuỗi ISO 8601.' })
	availableFrom?: string;

	@ApiPropertyOptional({ format: 'date-time' })
	@IsOptional()
	@IsDateString({}, { message: 'Hạn hoàn thành phải là chuỗi ISO 8601.' })
	dueAt?: string;

	@ApiPropertyOptional({
		type: Boolean,
		default: false,
		description: 'Công bố bài học ngay khi tạo (đặt `published_at = now()`).',
	})
	@IsOptional()
	@IsBoolean({ message: 'Trạng thái công bố phải là true hoặc false.' })
	isPublished?: boolean;
}
