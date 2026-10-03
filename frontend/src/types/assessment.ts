import type { PageMetaDto } from './index';

export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false';
export type QuizStatus = 'draft' | 'published' | 'closed';

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
	score: number;
	maxScore: number;
	correctCount: number;
	totalQuestions: number;
	passed: boolean | null;
	durationSeconds: number;
	status: string;
}

export interface SubmissionReview {
	submissionId: string;
	score: number | null;
	maxScore: number | null;
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
	status: string;
	score: number | null;
	maxScore: number | null;
	submittedAt: string | null;
	hasFeedback: boolean;
}

export interface CreateAssessmentQuiz {
	courseId: string;
	title: string;
	description?: string;
	timeLimitMinutes?: number | null;
	maxAttempts?: number;
	passScore?: number | null;
	shuffleQuestions?: boolean;
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
