import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';
import { trimString } from '../../common/transformers/trim.transformer';

/**
 * `POST /api/categories` (E3-T3) — chỉ `admin`.
 *
 * `slug` **không bắt buộc**: người quản trị thường chỉ nhập tên, và để hệ thống tự sinh slug là
 * cách duy nhất bảo đảm mọi danh mục đều có slug hợp lệ (chuẩn hoá dấu tiếng Việt).
 */
export class CreateCategoryDto {
	@ApiProperty({ example: 'Toán ứng dụng', minLength: 2, maxLength: 150 })
	@Transform(trimString)
	@IsString({ message: 'Tên danh mục phải là chuỗi.' })
	@MinLength(2, { message: 'Tên danh mục phải có ít nhất 2 ký tự.' })
	@MaxLength(150, { message: 'Tên danh mục tối đa 150 ký tự.' })
	name: string;

	@ApiPropertyOptional({
		example: 'toan-ung-dung',
		maxLength: 180,
		description: 'Bỏ trống để hệ thống sinh tự động từ `name`.',
	})
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Đường dẫn (slug) phải là chuỗi.' })
	@MaxLength(180, { message: 'Đường dẫn (slug) tối đa 180 ký tự.' })
	slug?: string;

	@ApiPropertyOptional({
		example: 'Khoá học toán cho kỹ thuật',
		maxLength: 5000,
		nullable: true,
	})
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Mô tả danh mục phải là chuỗi.' })
	@MaxLength(5000, { message: 'Mô tả danh mục tối đa 5000 ký tự.' })
	description?: string | null;

	@ApiPropertyOptional({
		nullable: true,
		description: 'Danh mục cha (UUID v4); `null` = danh mục gốc.',
	})
	@IsOptional()
	@IsUUID('4', { message: 'Danh mục cha không hợp lệ.' })
	parentId?: string | null;

	@ApiPropertyOptional({
		default: 0,
		minimum: 0,
		description: 'Thứ tự hiển thị trong cùng cấp.',
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'Thứ tự hiển thị phải là số nguyên.' })
	@Min(0, { message: 'Thứ tự hiển thị phải lớn hơn hoặc bằng 0.' })
	orderIndex?: number;

	@ApiPropertyOptional({ default: true, description: 'Hiện trong catalog.' })
	@IsOptional()
	@IsBoolean({ message: 'Trạng thái hiển thị phải là true/false.' })
	isActive?: boolean;
}
