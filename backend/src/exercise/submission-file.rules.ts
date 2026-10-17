import type { SubmissionMode, SubmissionStatus } from '../common/types';

/**
 * Quy tắc thuần của "bài tập nộp tệp" (yêu cầu 4.4) — tách khỏi `ExerciseService` để:
 *
 * 1. Test được bằng unit test không cần DB (repo đã có tiền lệ `assessment-grading.ts` +
 *    `assessment-grading.spec.ts`).
 * 2. Chỉ có **một** nơi định nghĩa "chế độ nào cần tệp / chế độ nào chấm tự động", nên tầng
 *    service, DTO và frontend không thể lệch nhau về cùng một luật.
 */

/** Trần số tệp của một lượt nộp — hàng rào chống lạm dụng dung lượng đĩa và RAM mỗi request. */
export const MAX_SUBMISSION_FILES = 5;

/** Điểm tối đa dùng khi `quizzes.max_score` để trống (bài nộp tệp). */
export const DEFAULT_SUBMISSION_MAX_SCORE = 10;

/** Thư mục con trong `UPLOAD_DIR` cho tệp bài nộp (học liệu dùng `lessons/<lessonId>`). */
export const SUBMISSION_FILE_FOLDER = 'submissions';

/** `quiz` chỉ nhận đáp án; `file`/`mixed` bắt buộc có ít nhất một tệp. */
export const needsSubmissionFile = (mode: SubmissionMode): boolean =>
	mode !== 'quiz';

/** Chỉ `quiz` mới bắt buộc có câu hỏi (và bắt buộc trả lời) — điều kiện publish & submit. */
export const requiresQuestions = (mode: SubmissionMode): boolean =>
	mode === 'quiz';

/**
 * `file`/`mixed` cho phép nộp sau hạn và ghi `is_late = true` thay vì chặn cứng.
 *
 * Vì sao khác `quiz`: bài nộp tệp thường là báo cáo/đồ án — chặn cứng khiến học viên mất luôn
 * cơ hội nộp, trong khi giá trị sư phạm nằm ở việc **biết** bài nào nộp muộn.
 */
export const allowsLateSubmission = (mode: SubmissionMode): boolean =>
	mode !== 'quiz';

/** Nộp xong là có điểm luôn (chấm tự động) hay phải chờ giảng viên chấm tay. */
export const isAutoGradedOnSubmit = (mode: SubmissionMode): boolean =>
	mode === 'quiz';

export const submissionStatusAfterSubmit = (
	mode: SubmissionMode,
): SubmissionStatus => (isAutoGradedOnSubmit(mode) ? 'graded' : 'submitted');

/** Chỉ được đính kèm/xoá tệp khi lượt làm còn đang mở. */
export const canAttachFile = (status: SubmissionStatus): boolean =>
	status === 'in_progress';

/** Còn được tải thêm tệp không (đếm theo số tệp hiện có). */
export const canUploadMoreFiles = (currentCount: number): boolean =>
	currentCount < MAX_SUBMISSION_FILES;

/**
 * Điểm tối đa của **phần nộp tệp**: 0 với `quiz`, `maxScore` (mặc định 10) với `file`/`mixed`.
 */
export const fileMaxScore = (
	mode: SubmissionMode,
	maxScore: number | null,
): number => {
	if (mode === 'quiz') return 0;
	return maxScore == null ? DEFAULT_SUBMISSION_MAX_SCORE : Number(maxScore);
};

/** Tổng điểm tối đa của một lượt làm = điểm câu hỏi + điểm phần nộp tệp. */
export const totalMaxScore = (
	mode: SubmissionMode,
	maxScore: number | null,
	questionPoints: number,
): number =>
	Math.round((questionPoints + fileMaxScore(mode, maxScore)) * 100) / 100;

/**
 * `Content-Disposition` cho tệp tải xuống.
 *
 * Tên tệp tiếng Việt có dấu không đi được trong `filename=` (header chỉ nhận ASCII), nên phải
 * gửi kèm dạng `filename*=UTF-8''…` theo RFC 5987 — nếu chỉ có bản ASCII thì trình duyệt lưu
 * tệp với tên đã bị thay dấu.
 */
export const buildContentDisposition = (fileName: string): string => {
	const asciiFallback =
		fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'download';
	return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};
