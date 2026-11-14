import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsInt,
	IsOptional,
	IsUUID,
	Max,
	Min,
} from 'class-validator';
import {
	CUSTOM_QUIZ_DEFAULT_QUESTIONS,
	CUSTOM_QUIZ_MAX_LESSONS,
} from '../custom-quiz.service';

export class CreateCustomQuizDto {
	@ApiProperty({
		type: [String],
		description: 'Các bài học (UUID) làm phạm vi đề.',
	})
	@IsArray({ message: 'Danh sách bài học không hợp lệ.' })
	@ArrayMinSize(1, { message: 'Hãy chọn ít nhất một bài học.' })
	@ArrayMaxSize(CUSTOM_QUIZ_MAX_LESSONS, {
		message: `Chỉ chọn tối đa ${CUSTOM_QUIZ_MAX_LESSONS} bài cho một quiz.`,
	})
	@IsUUID('4', { each: true, message: 'Mã bài học không hợp lệ.' })
	lessonIds!: string[];

	@ApiPropertyOptional({
		minimum: 5,
		maximum: 20,
		default: CUSTOM_QUIZ_DEFAULT_QUESTIONS,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'Số câu hỏi phải là số nguyên.' })
	@Min(5, { message: 'Tối thiểu 5 câu hỏi.' })
	@Max(20, { message: 'Tối đa 20 câu hỏi.' })
	questionCount: number = CUSTOM_QUIZ_DEFAULT_QUESTIONS;
}
