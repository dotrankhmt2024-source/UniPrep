import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';
import type { InterventionType } from '../../common/types';

const INTERVENTION_TYPES = [
	'in_app_message',
	'email_reminder',
	'recommended_lesson',
	'mentor_assignment',
	'manual_note',
] as const satisfies readonly InterventionType[];

export class AnalyticsQueryDto {
	@ApiPropertyOptional({ description: 'Chỉ xem một lớp', format: 'uuid' })
	@IsOptional()
	@IsUUID('4', { message: 'Lớp không hợp lệ.' })
	cohortId?: string;

	@ApiPropertyOptional({ minimum: 4, maximum: 26, default: 10 })
	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'Số tuần phải là số nguyên.' })
	@Min(4, { message: 'Tối thiểu 4 tuần.' })
	@Max(26, { message: 'Tối đa 26 tuần.' })
	weeks?: number;

	@ApiPropertyOptional({
		description: 'Số lượt can thiệp tối đa mà ASP được đề xuất trong lượt này',
		minimum: 0,
		maximum: 200,
		default: 10,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'Sức xử lý phải là số nguyên.' })
	@Min(0)
	@Max(200)
	capacity?: number;
}

export class DraftInterventionDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID('4', { message: 'Học viên không hợp lệ.' })
	userId: string;

	@ApiProperty({ enum: INTERVENTION_TYPES })
	@IsIn(INTERVENTION_TYPES, { message: 'Loại can thiệp không hợp lệ.' })
	type: InterventionType;
}

export class SendInterventionDto extends DraftInterventionDto {
	@ApiProperty({ maxLength: 200 })
	@IsString()
	@MinLength(3, { message: 'Tiêu đề tối thiểu 3 ký tự.' })
	@MaxLength(200, { message: 'Tiêu đề tối đa 200 ký tự.' })
	title: string;

	@ApiProperty({ maxLength: 2000 })
	@IsString()
	@MinLength(10, { message: 'Nội dung tối thiểu 10 ký tự.' })
	@MaxLength(2000, { message: 'Nội dung tối đa 2000 ký tự.' })
	content: string;

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(10)
	@IsUUID('4', { each: true, message: 'Bài học gợi ý không hợp lệ.' })
	recommendedLessonIds?: string[];
}
