import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
	IsBoolean,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
} from 'class-validator';
import { trimString } from '../../common/transformers/trim.transformer';

/** `POST /api/courses/:courseId/sections` (E3-T2). */
export class CreateSectionDto {
	@ApiProperty({ minLength: 1, maxLength: 255, example: 'Chương 1: Mở đầu' })
	@Transform(trimString)
	@IsString({ message: 'Tiêu đề chương phải là chuỗi.' })
	@MinLength(1, { message: 'Tiêu đề chương không được để trống.' })
	@MaxLength(255, { message: 'Tiêu đề chương tối đa 255 ký tự.' })
	title!: string;

	@ApiPropertyOptional({ maxLength: 2000 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Mô tả chương phải là chuỗi.' })
	@MaxLength(2000, { message: 'Mô tả chương tối đa 2000 ký tự.' })
	description?: string;

	@ApiPropertyOptional({
		type: Boolean,
		default: false,
		description: 'Công bố chương ngay khi tạo (đặt `published_at = now()`).',
	})
	@IsOptional()
	@IsBoolean({ message: 'Trạng thái công bố phải là true hoặc false.' })
	isPublished?: boolean;
}
