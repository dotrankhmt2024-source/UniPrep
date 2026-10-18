/**
 * Union type cho quiz & bài nộp — xem `docs/02-specs/database-design.md`
 * §7.6, §7.7.
 */

export type QuizType = 'practice' | 'graded';

export type QuestionType =
	'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';

export type SubmissionStatus =
	'in_progress' | 'submitted' | 'graded' | 'expired';

/**
 * Hình thức nộp của một bài tập/đánh giá (yêu cầu 4.4 "bài trắc nghiệm **và/hoặc**
 * bài tập nộp tệp"):
 *
 * - `quiz`  — chỉ trắc nghiệm; chấm tự động ngay khi nộp (`status = 'graded'`).
 * - `file`  — chỉ nộp tệp; không chấm tự động, giảng viên chấm tay (`status = 'submitted'`).
 * - `mixed` — vừa trắc nghiệm vừa nộp tệp: bắt buộc có tệp, phần trắc nghiệm (nếu có câu hỏi)
 *   được chấm tự động và lưu làm **điểm tạm**, giảng viên chốt điểm cuối cùng.
 */
export type SubmissionMode = 'quiz' | 'file' | 'mixed';

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

export const SUBMISSION_MODE_LABEL: Record<SubmissionMode, string> = {
	quiz: 'Trắc nghiệm',
	file: 'Nộp tệp',
	mixed: 'Trắc nghiệm + nộp tệp',
};

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
	in_progress: 'Đang làm',
	submitted: 'Đã nộp, chờ chấm',
	graded: 'Đã chấm',
	expired: 'Hết giờ',
};
