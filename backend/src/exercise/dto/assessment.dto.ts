import { Transform, Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsDateString,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const trim = ({ value }: { value: unknown }) =>
	typeof value === 'string' ? value.trim() : value;

export class CreateQuizDto {
	@IsUUID('4')
	courseId: string;

	@IsOptional()
	@IsUUID('4')
	lessonId?: string | null;

	@Transform(trim)
	@IsString()
	@MinLength(3)
	@MaxLength(200)
	title: string;

	@IsOptional()
	@IsString()
	@MaxLength(5000)
	description?: string | null;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(300)
	timeLimitMinutes?: number | null;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(10)
	maxAttempts?: number;

	@IsOptional()
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(10)
	passScore?: number | null;

	@IsOptional()
	@IsBoolean()
	shuffleQuestions?: boolean;

	@IsOptional()
	@IsDateString()
	openAt?: string | null;

	@IsOptional()
	@IsDateString()
	closeAt?: string | null;
}

export class UpdateQuizDto {
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MinLength(3)
	@MaxLength(200)
	title?: string;

	@IsOptional()
	@IsString()
	@MaxLength(5000)
	description?: string | null;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(300)
	timeLimitMinutes?: number | null;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(10)
	maxAttempts?: number;

	@IsOptional()
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(10)
	passScore?: number | null;

	@IsOptional()
	@IsBoolean()
	shuffleQuestions?: boolean;

	@IsOptional()
	@IsDateString()
	openAt?: string | null;

	@IsOptional()
	@IsDateString()
	closeAt?: string | null;
}

export class QuizListQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsUUID('4')
	courseId?: string;

	@IsOptional()
	@IsUUID('4')
	lessonId?: string;

	@IsOptional()
	@IsIn(['draft', 'published', 'closed'])
	status?: 'draft' | 'published' | 'closed';

	@IsOptional()
	@IsIn(['createdAt', 'title', 'openAt'])
	sortBy: 'createdAt' | 'title' | 'openAt' = 'createdAt';
}

export class SubmissionListQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsUUID('4')
	quizId?: string;

	@IsOptional()
	@IsUUID('4')
	courseId?: string;

	@IsOptional()
	@IsUUID('4')
	userId?: string;

	@IsOptional()
	@IsIn(['in_progress', 'submitted', 'graded', 'expired'])
	status?: 'in_progress' | 'submitted' | 'graded' | 'expired';
}

export class QuizOptionDto {
	@Transform(trim)
	@IsString()
	@MinLength(1)
	@MaxLength(1000)
	content: string;

	@IsBoolean()
	isCorrect: boolean;
}

export class CreateQuestionDto {
	@Transform(trim)
	@IsString()
	@MinLength(1)
	@MaxLength(10000)
	content: string;

	@IsIn(['single_choice', 'multiple_choice', 'true_false'])
	type: 'single_choice' | 'multiple_choice' | 'true_false';

	@IsOptional()
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(999.99)
	points?: number;

	@IsOptional()
	@IsString()
	@MaxLength(5000)
	explanation?: string | null;

	@IsArray()
	@ArrayMinSize(2)
	@Type(() => QuizOptionDto)
	options: QuizOptionDto[];
}

export class UpdateQuestionDto {
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MinLength(1)
	@MaxLength(10000)
	content?: string;

	@IsOptional()
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(999.99)
	points?: number;

	@IsOptional()
	@IsString()
	@MaxLength(5000)
	explanation?: string | null;
}

export class SubmitAnswerDto {
	@IsUUID('4')
	questionId: string;

	@IsOptional()
	@IsArray()
	@IsUUID('4', { each: true })
	selectedOptionIds?: string[];
}

export class SubmitQuizDto {
	@IsUUID('4')
	attemptId: string;

	@IsArray()
	@ArrayMinSize(1)
	@Type(() => SubmitAnswerDto)
	answers: SubmitAnswerDto[];
}

export class FeedbackDto {
	@IsOptional()
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	score?: number;

	@IsOptional()
	@IsString()
	@MaxLength(5000)
	teacherFeedback?: string | null;
}
