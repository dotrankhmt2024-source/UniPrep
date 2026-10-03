import { ApiPropertyOptional } from '@nestjs/swagger';
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
 * `PATCH /api/cohorts/:id` (E3-T1) — chỉ `teacher`/`admin` phụ trách khoá chứa lớp.
 *
 * `courseId` **không** nằm trong DTO: chuyển lớp sang khoá khác sẽ làm mọi ghi danh và phân công
 * đang trỏ tới lớp đó mang nghĩa khác — muốn đổi thì tạo lớp mới rồi chuyển học viên.
 */
export class UpdateCohortDto {
	@ApiPropertyOptional({ minLength: 1, maxLength: 150 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Tên lớp phải là chuỗi.' })
	@MinLength(1, { message: 'Tên lớp không được để trống.' })
	@MaxLength(150, { message: 'Tên lớp tối đa 150 ký tự.' })
	name?: string;

	@ApiPropertyOptional({ maxLength: 50, nullable: true })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Mã lớp phải là chuỗi.' })
	@MaxLength(50, { message: 'Mã lớp tối đa 50 ký tự.' })
	classCode?: string | null;

	@ApiPropertyOptional({ maxLength: 50, nullable: true })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Mã nhóm phải là chuỗi.' })
	@MaxLength(50, { message: 'Mã nhóm tối đa 50 ký tự.' })
	groupCode?: string | null;

	@ApiPropertyOptional({ maxLength: 20, nullable: true })
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
