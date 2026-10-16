/**
 * Union type cho quiz & bài nộp — xem `docs/02-specs/database-design.md`
 * §7.6, §7.7.
 */

export type QuizType = 'practice' | 'graded';

export type QuestionType =
	'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';

export type SubmissionStatus =
	'in_progress' | 'submitted' | 'graded' | 'expired';

export const QUIZ_TYPE_LABEL: Record<QuizType, string> = {
	practice: 'Luyện tập',
	graded: 'Tính điểm',
};

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
	single_choice: 'Một đáp án',
	multiple_choice: 'Nhiều đáp án',
	true_false: 'Đúng / Sai',
	short_answer: 'Trả lời ngắn',
	essay: 'Tự luận',
};

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
	in_progress: 'Đang làm',
	submitted: 'Đã nộp, chờ chấm',
	graded: 'Đã chấm',
	expired: 'Hết giờ',
};
