import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
	IsBoolean,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';
import { trimString } from '../../common/transformers/trim.transformer';
import {
	COURSE_LEVEL_LABEL,
	COURSE_LEVEL_VALUES,
	COURSE_VISIBILITY_LABEL,
	COURSE_VISIBILITY_VALUES,
	type CourseLevel,
	type CourseVisibility,
} from '../../common/types';

/**
 * `PATCH /api/courses/:id` (E3-T1) — `teacher` (được phân công) hoặc `admin`.
 *
 * Mọi trường tuỳ chọn; service chỉ ghi những khoá client thực sự gửi (`undefined` = không đổi).
 * **Không có `status`**: đổi vòng đời chỉ qua `publish`/`unpublish` để hai đường đó kiểm tra được
 * điều kiện "phải có bài học" và giữ `published_at` nhất quán.
 *
 * `ownerId` chỉ `admin` đổi được; service trả `403` nếu `teacher` gửi trường này (khác `POST`, nơi
 * giá trị bị bỏ qua — sửa chủ sở hữu là thao tác quản trị, không phải trường form vô hại).
 */
export class UpdateCourseDto {
	@ApiPropertyOptional({ example: 'CS102', minLength: 2, maxLength: 50 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Mã khoá học phải là chuỗi.' })
	@MinLength(2, { message: 'Mã khoá học phải có ít nhất 2 ký tự.' })
	@MaxLength(50, { message: 'Mã khoá học tối đa 50 ký tự.' })
	@Matches(/^[A-Za-z0-9._-]+$/, {
		message: 'Mã khoá học chỉ gồm chữ, số, dấu gạch, chấm hoặc gạch dưới.',
	})
	code?: string;

	@ApiPropertyOptional({ minLength: 3, maxLength: 255 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Tên khoá học phải là chuỗi.' })
	@MinLength(3, { message: 'Tên khoá học phải có ít nhất 3 ký tự.' })
	@MaxLength(255, { message: 'Tên khoá học tối đa 255 ký tự.' })
	title?: string;

	@ApiPropertyOptional({ maxLength: 280 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Đường dẫn (slug) phải là chuỗi.' })
	@MaxLength(280, { message: 'Đường dẫn (slug) tối đa 280 ký tự.' })
	slug?: string;

	@ApiPropertyOptional({ maxLength: 500, nullable: true })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Mô tả ngắn phải là chuỗi.' })
	@MaxLength(500, { message: 'Mô tả ngắn tối đa 500 ký tự.' })
	summary?: string | null;

	@ApiPropertyOptional({ maxLength: 20000, nullable: true })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Đề cương phải là chuỗi.' })
	@MaxLength(20000, { message: 'Đề cương tối đa 20000 ký tự.' })
	description?: string | null;

	@ApiPropertyOptional({ nullable: true, description: 'UUID v4 hoặc null.' })
	@IsOptional()
	@IsUUID('4', { message: 'Danh mục không hợp lệ.' })
	categoryId?: string | null;

	@ApiPropertyOptional({
		description:
			'Chỉ `admin` được đổi chủ sở hữu (UUID v4, vai trò `teacher`).',
	})
	@IsOptional()
	@IsUUID('4', { message: 'Giảng viên phụ trách không hợp lệ.' })
	ownerId?: string;

	@ApiPropertyOptional({ maxLength: 512, nullable: true })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Ảnh bìa phải là chuỗi.' })
	@MaxLength(512, { message: 'Ảnh bìa tối đa 512 ký tự.' })
	coverUrl?: string | null;

	@ApiPropertyOptional({
		enum: COURSE_LEVEL_VALUES,
		nullable: true,
		description: COURSE_LEVEL_VALUES.map(
			(level) => `${level}: ${COURSE_LEVEL_LABEL[level]}`,
		).join(' · '),
	})
	@IsOptional()
	@IsIn(COURSE_LEVEL_VALUES, {
		message: `Trình độ không hợp lệ (chỉ nhận: ${COURSE_LEVEL_VALUES.join(', ')}).`,
	})
	level?: CourseLevel | null;

	@ApiPropertyOptional({
		enum: COURSE_VISIBILITY_VALUES,
		description: COURSE_VISIBILITY_VALUES.map(
			(value) => `${value}: ${COURSE_VISIBILITY_LABEL[value]}`,
		).join(' · '),
	})
	@IsOptional()
	@IsIn(COURSE_VISIBILITY_VALUES, {
		message: `Phạm vi hiển thị không hợp lệ (chỉ nhận: ${COURSE_VISIBILITY_VALUES.join(', ')}).`,
	})
	visibility?: CourseVisibility;

	@ApiPropertyOptional({ maxLength: 10 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Ngôn ngữ phải là chuỗi.' })
	@MaxLength(10, { message: 'Ngôn ngữ tối đa 10 ký tự.' })
	language?: string;

	@ApiPropertyOptional({
		example: '2/2026-2027',
		maxLength: 20,
		nullable: true,
	})
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Học kỳ phải là chuỗi.' })
	@MaxLength(20, { message: 'Học kỳ tối đa 20 ký tự.' })
	semester?: string | null;

	@ApiPropertyOptional({
		minimum: 0,
		maximum: 9999,
		nullable: true,
		description: 'Cột là `numeric(5,1)` nên nhận số nguyên 0–9999.',
	})
	@IsOptional()
	@IsInt({ message: 'Số giờ dự kiến phải là số nguyên.' })
	@Min(0, { message: 'Số giờ dự kiến phải lớn hơn hoặc bằng 0.' })
	@Max(9999, { message: 'Số giờ dự kiến tối đa 9999.' })
	estimatedHours?: number | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean({ message: 'Trạng thái mở đăng ký phải là true/false.' })
	enrollmentOpen?: boolean;

	@ApiPropertyOptional({ minimum: 1, nullable: true })
	@IsOptional()
	@IsInt({ message: 'Sĩ số tối đa phải là số nguyên.' })
	@Min(1, { message: 'Sĩ số tối đa phải lớn hơn 0.' })
	maxStudents?: number | null;
}
