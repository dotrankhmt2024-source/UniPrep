import {
	DEFAULT_SUBMISSION_MAX_SCORE,
	MAX_SUBMISSION_FILES,
	allowsLateSubmission,
	buildContentDisposition,
	canAttachFile,
	canUploadMoreFiles,
	fileMaxScore,
	isAutoGradedOnSubmit,
	needsSubmissionFile,
	requiresQuestions,
	submissionStatusAfterSubmit,
	totalMaxScore,
} from './submission-file.rules';

/**
 * Quy tắc "bài tập và đánh giá" (yêu cầu 4.4) là logic thuần nên phải test được không cần DB —
 * cùng cách tiếp cận với `assessment-grading.spec.ts`.
 */
describe('submission-file rules', () => {
	it('requires a file for file and mixed modes, but not for quiz', () => {
		expect(needsSubmissionFile('quiz')).toBe(false);
		expect(needsSubmissionFile('file')).toBe(true);
		expect(needsSubmissionFile('mixed')).toBe(true);
	});

	it('requires questions only for quiz mode', () => {
		expect(requiresQuestions('quiz')).toBe(true);
		expect(requiresQuestions('file')).toBe(false);
		expect(requiresQuestions('mixed')).toBe(false);
	});

	it('accepts late submissions for file based modes and rejects them for quiz', () => {
		expect(allowsLateSubmission('quiz')).toBe(false);
		expect(allowsLateSubmission('file')).toBe(true);
		expect(allowsLateSubmission('mixed')).toBe(true);
	});

	it('auto grades only quiz mode and marks the rest as awaiting manual grading', () => {
		expect(isAutoGradedOnSubmit('quiz')).toBe(true);
		expect(submissionStatusAfterSubmit('quiz')).toBe('graded');

		expect(isAutoGradedOnSubmit('file')).toBe(false);
		expect(submissionStatusAfterSubmit('file')).toBe('submitted');

		expect(isAutoGradedOnSubmit('mixed')).toBe(false);
		expect(submissionStatusAfterSubmit('mixed')).toBe('submitted');
	});

	it('allows attaching files only while the attempt is in progress', () => {
		expect(canAttachFile('in_progress')).toBe(true);
		expect(canAttachFile('submitted')).toBe(false);
		expect(canAttachFile('graded')).toBe(false);
		expect(canAttachFile('expired')).toBe(false);
	});

	it('stops accepting files at the per-attempt limit', () => {
		for (let count = 0; count < MAX_SUBMISSION_FILES; count += 1) {
			expect(canUploadMoreFiles(count)).toBe(true);
		}
		expect(canUploadMoreFiles(MAX_SUBMISSION_FILES)).toBe(false);
		expect(canUploadMoreFiles(MAX_SUBMISSION_FILES + 1)).toBe(false);
	});

	describe('max score', () => {
		it('ignores the file score column for quiz mode', () => {
			expect(fileMaxScore('quiz', 50)).toBe(0);
			expect(totalMaxScore('quiz', 50, 8)).toBe(8);
		});

		it('falls back to the default when the file score is null', () => {
			expect(fileMaxScore('file', null)).toBe(DEFAULT_SUBMISSION_MAX_SCORE);
			expect(totalMaxScore('file', null, 0)).toBe(DEFAULT_SUBMISSION_MAX_SCORE);
		});

		it('adds the file score on top of question points for mixed mode', () => {
			expect(totalMaxScore('mixed', 5, 10)).toBe(15);
			expect(totalMaxScore('file', 20, 0)).toBe(20);
		});

		it('rounds the total to two decimals like the numeric column', () => {
			expect(totalMaxScore('mixed', 2.555, 1.1)).toBe(3.66);
		});
	});

	describe('content disposition', () => {
		it('keeps an ASCII file name in both forms', () => {
			expect(buildContentDisposition('report.pdf')).toBe(
				`attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`,
			);
		});

		it('transliterates Vietnamese names for the ASCII fallback and keeps UTF-8 in filename*', () => {
			const header = buildContentDisposition('Báo cáo đồ án.pdf');
			expect(header).toContain(
				"filename*=UTF-8''B%C3%A1o%20c%C3%A1o%20%C4%91%E1%BB%93%20%C3%A1n.pdf",
			);
			expect(header).toMatch(/filename="[\x20-\x7e]+"/);
			expect(header).not.toContain('"Báo');
		});

		it('neutralises quotes and backslashes that would break the header', () => {
			expect(buildContentDisposition('a"b\\c.txt')).toContain(
				'filename="a_b_c.txt"',
			);
		});

		it('still produces a usable name when the original is empty or unprintable', () => {
			// Rỗng ⇒ nhãn dự phòng cố định; ký tự không in được ⇒ thay bằng `_` để header vẫn hợp lệ.
			expect(buildContentDisposition('')).toContain('filename="download"');
			expect(buildContentDisposition('\u0001\u0002')).toContain(
				'filename="__"',
			);
		});
	});
});
