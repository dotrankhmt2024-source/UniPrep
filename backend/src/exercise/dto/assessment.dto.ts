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
import type { SubmissionMode } from '../../common/types';

const trim = ({ value }: { value: unknown }) =>
	typeof value === 'string' ? value.trim() : value;

/** Tập giá trị hợp lệ của `submission_mode` — dùng chung cho create/update để không lệch nhau. */
const SUBMISSION_MODES: SubmissionMode[] = ['quiz', 'file', 'mixed'];

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
	/**
	 * Hình thức nộp: `quiz` (trắc nghiệm), `file` (nộp tệp), `mixed` (cả hai). Bỏ trống ⇒ `quiz`.
	 */
	@IsOptional()
	@IsIn(SUBMISSION_MODES, {
		message: 'Hình thức nộp phải là quiz, file hoặc mixed.',
	})
	submissionMode?: SubmissionMode;

	/**
	 * Điểm tối đa của phần nộp tệp; bỏ trống ⇒ 10. Không dùng cho chế độ `quiz`.
	 *
	 * Cận dưới là `0.01` (không phải `0`) để khớp CHECK `chk_quizzes_max_score` của DB: cho `0` qua
	 * DTO sẽ biến một lỗi nhập liệu thành `500` do vi phạm ràng buộc, thay vì `400` có thông báo rõ.
	 */
	@IsOptional()
	@Type(() => Number)
	@IsNumber(
		{ maxDecimalPlaces: 2 },
		{
			message:
				'Điểm tối đa phần nộp tệp phải là số có tối đa 2 chữ số thập phân.',
		},
	)
	@Min(0.01, { message: 'Điểm tối đa phần nộp tệp phải lớn hơn 0.' })
	@Max(1000)
	maxScore?: number | null;
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
	@IsOptional()
	@IsIn(SUBMISSION_MODES, {
		message: 'Hình thức nộp phải là quiz, file hoặc mixed.',
	})
	submissionMode?: SubmissionMode;

	@IsOptional()
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0.01, { message: 'Điểm tối đa phần nộp tệp phải lớn hơn 0.' })
	@Max(1000)
	maxScore?: number | null;
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

	/**
	 * Đáp án trắc nghiệm. **Tuỳ chọn** vì `file`/`mixed` có thể không có câu hỏi; ràng buộc
	 * "chế độ `quiz` phải có ≥ 1 đáp án" do tầng service kiểm tra — nó phụ thuộc `submission_mode`
	 * của quiz chứ không phải hình dạng DTO.
	 */
	@IsOptional()
	@IsArray()
	@Type(() => SubmitAnswerDto)
	answers?: SubmitAnswerDto[];
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
