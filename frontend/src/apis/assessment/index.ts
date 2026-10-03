import { queryMethod } from '@/config';
import type {
	AssessmentListResponse,
	AssessmentQuestion,
	AssessmentQuiz,
	AssessmentSubmissionListResponse,
	CreateAssessmentQuestion,
	CreateAssessmentQuiz,
	DefaultResponseType,
	QuizAttempt,
	QuizSubmissionResult,
	SubmissionReview,
	FeedbackPayload,
} from '@/types';

export const getQuizzes = (params: {
	courseId: string;
	page?: number;
	take?: number;
}) =>
	queryMethod.get('/quizzes', { params }) as Promise<
		DefaultResponseType<AssessmentListResponse>
	>;

export const getQuiz = (quizId: string) =>
	queryMethod.get(`/quizzes/${quizId}`) as Promise<
		DefaultResponseType<AssessmentQuiz>
	>;

export const createQuiz = (payload: CreateAssessmentQuiz) =>
	queryMethod.post('/quizzes', payload) as Promise<
		DefaultResponseType<AssessmentQuiz>
	>;

export const addQuestion = (
	quizId: string,
	payload: CreateAssessmentQuestion,
) =>
	queryMethod.post(`/quizzes/${quizId}/questions`, payload) as Promise<
		DefaultResponseType<AssessmentQuestion>
	>;

export const getQuizQuestions = (quizId: string) =>
	queryMethod.get(`/quizzes/${quizId}/questions`) as Promise<
		DefaultResponseType<{ items: AssessmentQuestion[] }>
	>;

export const publishQuiz = (quizId: string) =>
	queryMethod.patch(`/quizzes/${quizId}/publish`) as Promise<
		DefaultResponseType<{ id: string; status: string }>
	>;

export const updateQuestion = (
	questionId: string,
	payload: { content?: string; points?: number; explanation?: string | null },
) =>
	queryMethod.patch(`/questions/${questionId}`, payload) as Promise<
		DefaultResponseType<AssessmentQuestion>
	>;

export const deleteQuestion = (questionId: string) =>
	queryMethod.delete(`/questions/${questionId}`) as Promise<
		DefaultResponseType<{ success: boolean }>
	>;

export const getQuizSubmissions = (quizId: string) =>
	queryMethod.get('/submissions', {
		params: { quizId, page: 1, take: 100 },
	}) as Promise<DefaultResponseType<AssessmentSubmissionListResponse>>;

export const updateSubmissionFeedback = (
	submissionId: string,
	payload: FeedbackPayload,
) =>
	queryMethod.patch(
		`/submissions/${submissionId}/feedback`,
		payload,
	) as Promise<
		DefaultResponseType<{
			id: string;
			score: number | null;
			teacherFeedback: string | null;
		}>
	>;

export const startQuizAttempt = (quizId: string) =>
	queryMethod.post(`/quizzes/${quizId}/attempts`, {}) as Promise<
		DefaultResponseType<QuizAttempt>
	>;

export const getQuizAttempt = (attemptId: string) =>
	queryMethod.get(`/attempts/${attemptId}`) as Promise<
		DefaultResponseType<QuizAttempt>
	>;

export const submitQuizAttempt = (payload: {
	attemptId: string;
	answers: Array<{ questionId: string; selectedOptionIds: string[] }>;
}) =>
	queryMethod.post('/submissions', payload) as Promise<
		DefaultResponseType<QuizSubmissionResult>
	>;

export const getSubmissionReview = (submissionId: string) =>
	queryMethod.get(`/submissions/${submissionId}/review`) as Promise<
		DefaultResponseType<SubmissionReview>
	>;
