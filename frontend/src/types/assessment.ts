import type { PageMetaDto } from './index';

export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false';
export type QuizStatus = 'draft' | 'published' | 'closed';
/**
 * Hình thức nộp của một bài tập/đánh giá (yêu cầu 4.4):
 * `quiz` = trắc nghiệm, `file` = nộp tệp, `mixed` = vừa trắc nghiệm vừa nộp tệp.
 */
export type SubmissionMode = 'quiz' | 'file' | 'mixed';

export const SUBMISSION_MODE_LABEL: Record<SubmissionMode, string> = {
	quiz: 'Trắc nghiệm',
	file: 'Nộp tệp',
	mixed: 'Trắc nghiệm + nộp tệp',
};

/** Tệp học viên đã đính kèm cho một lượt làm bài. */
export interface SubmissionFile {
	id: string;
	submissionId: string;
	originalName: string;
	mimeType: string;
	fileSizeBytes: number;
	uploadedBy: string | null;
	downloadUrl: string;
	createdAt: string;
	viewUrl: string;
	canPreview: boolean;
}

export interface SubmissionFilesResponse {
	submissionId: string;
	submissionMode: SubmissionMode;
	/** Server quyết định có cho tải tệp lên hay không — FE không tự suy ra từ trạng thái. */
	allowUpload: boolean;
	maxFiles: number;
	items: SubmissionFile[];
}

export interface AssessmentOption {
	id: string;
	content: string;
	orderIndex: number;
	isCorrect?: boolean;
}

export interface AssessmentQuestion {
	id: string;
	quizId: string;
	content: string;
	type: QuestionType;
	points: number;
	orderIndex: number;
	explanation: string | null;
	options: AssessmentOption[];
}

export interface AssessmentQuiz {
	id: string;
	courseId: string;
	lessonId: string | null;
	title: string;
	description: string | null;
	status: QuizStatus;
	timeLimitMinutes: number | null;
	maxAttempts: number | null;
	questionCount: number;
	totalPoints: number;
	submissionMode: SubmissionMode;
	/** Điểm tối đa của phần nộp tệp; `null` nghĩa là dùng mặc định 10 ở backend. */
	fileMaxScore: number | null;
	passScore: number | null;
	shuffleQuestions: boolean;
	openAt: string | null;
	closeAt: string | null;
	myBestScore: number | null;
	myAttemptCount?: number;
	createdAt: string;
	updatedAt: string;
	questions?: AssessmentQuestion[];
}

export interface PaginatedAssessmentQuizzes {
	items: AssessmentQuiz[];
	meta: PageMetaDto;
}

export interface QuizAttempt {
	id: string;
	quizId: string;
	userId: string;
	attemptNo: number;
	status: 'in_progress' | 'submitted' | 'graded' | 'expired';
	startedAt: string;
	expiresAt: string | null;
	submissionMode: SubmissionMode;
	fileMaxScore: number | null;
	maxFiles: number;
	/** Tệp đã tải lên trong lượt này — có ngay cả khi lượt chưa nộp, để không tải trùng. */
	files: SubmissionFile[];
	questions: Array<{
		id: string;
		content: string;
		type: QuestionType;
		points: number;
		orderIndex: number;
		options: AssessmentOption[];
	}>;
	answers?: Array<{ questionId: string; selectedOptionIds: string[] | null }>;
}

export interface QuizSubmissionResult {
	id: string;
	attemptId: string;
	quizId: string;
	submissionMode: SubmissionMode;
	score: number | null;
	maxScore: number;
	correctCount: number | null;
	totalQuestions: number;
	passed: boolean | null;
	autoGraded: boolean;
	/** `true` ⇒ `score` là điểm tạm của phần trắc nghiệm, chờ giảng viên chốt. */
	awaitingManualGrading: boolean;
	isLate: boolean;
	fileCount: number;
	durationSeconds: number;
	status: string;
}

export interface SubmissionReview {
	submissionId: string;
	submissionMode: SubmissionMode;
	status: string;
	score: number | null;
	maxScore: number | null;
	awaitingManualGrading: boolean;
	teacherFeedback: string | null;
	feedbackAt: string | null;
	isLate: boolean;
	files: SubmissionFile[];
	items: Array<{
		questionId: string;
		content: string;
		type: QuestionType;
		points: number;
		earnedPoints: number;
		isCorrect: boolean;
		selectedOptionIds: string[];
		correctOptionIds: string[];
		explanation: string | null;
		options: Array<{ id: string; content: string }>;
	}>;
}

export interface AssessmentSubmission {
	id: string;
	quiz: { id: string; title: string };
	student: { id: string; fullName: string; studentCode: string | null };
	userId: string;
	attemptNo: number;
	submissionMode: SubmissionMode;
	status: string;
	score: number | null;
	maxScore: number | null;
	fileCount: number;
	isLate: boolean;
	submittedAt: string | null;
	hasFeedback: boolean;
}

export interface CreateAssessmentQuiz {
	courseId: string;
	title: string;
	description?: string;
	submissionMode?: SubmissionMode;
	maxScore?: number | null;
	timeLimitMinutes?: number | null;
	maxAttempts?: number;
	passScore?: number | null;
	shuffleQuestions?: boolean;
	openAt?: string | null;
	closeAt?: string | null;
}

export interface CreateAssessmentQuestion {
	content: string;
	type: QuestionType;
	points: number;
	options: Array<{ content: string; isCorrect: boolean }>;
}

export interface AssessmentListResponse {
	items: AssessmentQuiz[];
	meta: PageMetaDto;
}

export interface AssessmentSubmissionListResponse {
	items: AssessmentSubmission[];
	meta: PageMetaDto;
}

export interface FeedbackPayload {
	score?: number;
	teacherFeedback?: string | null;
}
