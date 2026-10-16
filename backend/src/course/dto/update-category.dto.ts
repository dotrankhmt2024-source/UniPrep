import { ApiPropertyOptional } from '@nestjs/swagger';
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
 * `PATCH /api/categories/:id` (E3-T3) — chỉ `admin`, mọi trường tuỳ chọn.
 *
 * Không có `parentId` trỏ tới chính nó ở tầng DTO: việc đó cần biết `id` trên đường dẫn nên
 * `CategoryService` kiểm tra (khác `id` mới hợp lệ) trước khi ghi.
 */
export class UpdateCategoryDto {
	@ApiPropertyOptional({ example: 'Toán ứng dụng và Thống kê', maxLength: 150 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Tên danh mục phải là chuỗi.' })
	@MinLength(2, { message: 'Tên danh mục phải có ít nhất 2 ký tự.' })
	@MaxLength(150, { message: 'Tên danh mục tối đa 150 ký tự.' })
	name?: string;

	@ApiPropertyOptional({ example: 'toan-ung-dung-thong-ke', maxLength: 180 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Đường dẫn (slug) phải là chuỗi.' })
	@MaxLength(180, { message: 'Đường dẫn (slug) tối đa 180 ký tự.' })
	slug?: string;

	@ApiPropertyOptional({ maxLength: 5000, nullable: true })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Mô tả danh mục phải là chuỗi.' })
	@MaxLength(5000, { message: 'Mô tả danh mục tối đa 5000 ký tự.' })
	description?: string | null;

	@ApiPropertyOptional({
		nullable: true,
		description: 'Danh mục cha (UUID v4); `null` = chuyển về danh mục gốc.',
	})
	@IsOptional()
	@IsUUID('4', { message: 'Danh mục cha không hợp lệ.' })
	parentId?: string | null;

	@ApiPropertyOptional({ minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'Thứ tự hiển thị phải là số nguyên.' })
	@Min(0, { message: 'Thứ tự hiển thị phải lớn hơn hoặc bằng 0.' })
	orderIndex?: number;

	@ApiPropertyOptional({ description: 'Hiện/ẩn danh mục trong catalog.' })
	@IsOptional()
	@IsBoolean({ message: 'Trạng thái hiển thị phải là true/false.' })
	isActive?: boolean;
}
