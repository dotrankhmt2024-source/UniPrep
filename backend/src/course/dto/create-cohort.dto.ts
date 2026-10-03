import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
	IsDateString,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
} from 'class-validator';
import { trimString } from '../../common/transformers/trim.transformer';

/**
 * `POST /api/courses/:id/cohorts` (E3-T1) — tạo lớp/nhóm học viên trong khoá học.
 *
 * Khoảng thời gian nhận chuỗi ISO (`YYYY-MM-DD`) và được service so sánh `endsOn >= startsOn`;
 * CHECK `chk_cohorts_dates` ở DB chỉ là chốt chặn cuối (nó trả lỗi driver khó đọc), còn `400` có
 * thông điệp tiếng Việt mới là hợp đồng với FE.
 */
export class CreateCohortDto {
	@ApiProperty({ example: 'Lớp K67-CS1', minLength: 1, maxLength: 150 })
	@Transform(trimString)
	@IsString({ message: 'Tên lớp phải là chuỗi.' })
	@MinLength(1, { message: 'Tên lớp không được để trống.' })
	@MaxLength(150, { message: 'Tên lớp tối đa 150 ký tự.' })
	name: string;

	@ApiPropertyOptional({ example: 'L01', maxLength: 50, nullable: true })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Mã lớp phải là chuỗi.' })
	@MaxLength(50, { message: 'Mã lớp tối đa 50 ký tự.' })
	classCode?: string | null;

	@ApiPropertyOptional({ example: 'CQ_HK261', maxLength: 50, nullable: true })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Mã nhóm phải là chuỗi.' })
	@MaxLength(50, { message: 'Mã nhóm tối đa 50 ký tự.' })
	groupCode?: string | null;

	@ApiPropertyOptional({
		example: '1/2026-2027',
		maxLength: 20,
		nullable: true,
	})
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Học kỳ phải là chuỗi.' })
	@MaxLength(20, { message: 'Học kỳ tối đa 20 ký tự.' })
	semester?: string | null;

	@ApiPropertyOptional({ example: '2026-09-01', nullable: true })
	@IsOptional()
	@IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ (YYYY-MM-DD).' })
	startsOn?: string | null;

	@ApiPropertyOptional({ example: '2027-01-15', nullable: true })
	@IsOptional()
	@IsDateString({}, { message: 'Ngày kết thúc không hợp lệ (YYYY-MM-DD).' })
	endsOn?: string | null;
}
