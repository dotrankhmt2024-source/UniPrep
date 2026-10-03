import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
	IsBoolean,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
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
 * `POST /api/courses` (E3-T1) — `teacher` hoặc `admin`.
 *
 * **Không có `status`:** mọi khoá học mới đều bắt đầu ở `draft` (đúng luồng nghiệp vụ: soạn nội
 * dung trước, công bố sau bằng `PATCH /:id/publish`). Nhận `status` từ body sẽ cho phép tạo khoá
 * đã `published` mà chưa có bài học nào.
 *
 * `ownerId` chỉ có tác dụng với `admin`; khi `teacher` gửi, service **bỏ qua** thay vì `400` —
 * FE dùng chung một form cho cả hai vai trò nên từ chối sẽ làm hỏng luồng của giảng viên.
 */
export class CreateCourseDto {
	@ApiProperty({ example: 'CS102', minLength: 2, maxLength: 50 })
	@Transform(trimString)
	@IsString({ message: 'Mã khoá học phải là chuỗi.' })
	@MinLength(2, { message: 'Mã khoá học phải có ít nhất 2 ký tự.' })
	@MaxLength(50, { message: 'Mã khoá học tối đa 50 ký tự.' })
	@Matches(/^[A-Za-z0-9._-]+$/, {
		message: 'Mã khoá học chỉ gồm chữ, số, dấu gạch, chấm hoặc gạch dưới.',
	})
	code: string;

	@ApiProperty({
		example: 'Cấu trúc dữ liệu và giải thuật',
		minLength: 3,
		maxLength: 255,
	})
	@Transform(trimString)
	@IsString({ message: 'Tên khoá học phải là chuỗi.' })
	@MinLength(3, { message: 'Tên khoá học phải có ít nhất 3 ký tự.' })
	@MaxLength(255, { message: 'Tên khoá học tối đa 255 ký tự.' })
	title: string;

	@ApiPropertyOptional({
		example: 'cau-truc-du-lieu-va-giai-thuat',
		maxLength: 280,
		description: 'Bỏ trống để hệ thống sinh tự động từ `title`.',
	})
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

	@ApiPropertyOptional({
		description: 'Danh mục (UUID v4); bỏ trống = chưa phân loại.',
	})
	@IsOptional()
	@IsUUID('4', { message: 'Danh mục không hợp lệ.' })
	categoryId?: string | null;

	@ApiPropertyOptional({
		description:
			'Giảng viên phụ trách (UUID v4, phải có vai trò `teacher`). Chỉ `admin` gửi được; `teacher` gửi sẽ bị bỏ qua vì chính họ là chủ sở hữu.',
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
		default: 'public',
		description: COURSE_VISIBILITY_VALUES.map(
			(value) => `${value}: ${COURSE_VISIBILITY_LABEL[value]}`,
		).join(' · '),
	})
	@IsOptional()
	@IsIn(COURSE_VISIBILITY_VALUES, {
		message: `Phạm vi hiển thị không hợp lệ (chỉ nhận: ${COURSE_VISIBILITY_VALUES.join(', ')}).`,
	})
	visibility?: CourseVisibility;

	@ApiPropertyOptional({ example: 'vi', maxLength: 10, default: 'vi' })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Ngôn ngữ phải là chuỗi.' })
	@MaxLength(10, { message: 'Ngôn ngữ tối đa 10 ký tự.' })
	language?: string;

	@ApiPropertyOptional({ example: '1/2026-2027', maxLength: 20 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Học kỳ phải là chuỗi.' })
	@MaxLength(20, { message: 'Học kỳ tối đa 20 ký tự.' })
	semester?: string | null;

	@ApiPropertyOptional({
		example: 45,
		minimum: 0,
		nullable: true,
		description: 'Số giờ tín chỉ dự kiến.',
	})
	@IsOptional()
	@IsInt({ message: 'Số giờ dự kiến phải là số nguyên.' })
	@Min(0, { message: 'Số giờ dự kiến phải lớn hơn hoặc bằng 0.' })
	estimatedHours?: number | null;

	@ApiPropertyOptional({ default: true })
	@IsOptional()
	@IsBoolean({ message: 'Trạng thái mở đăng ký phải là true/false.' })
	enrollmentOpen?: boolean;

	@ApiPropertyOptional({
		minimum: 1,
		nullable: true,
		description: 'Sĩ số tối đa; `null` = không giới hạn.',
	})
	@IsOptional()
	@IsInt({ message: 'Sĩ số tối đa phải là số nguyên.' })
	@Min(1, { message: 'Sĩ số tối đa phải lớn hơn 0.' })
	maxStudents?: number | null;
}
