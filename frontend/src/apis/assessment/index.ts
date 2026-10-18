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
	SubmissionFile,
	SubmissionFilesResponse,
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

/**
 * `POST /api/submissions` — nộp bài.
 *
 * `answers` là **tuỳ chọn** vì chế độ `file`/`mixed` có thể không có câu hỏi trắc nghiệm nào; ràng
 * buộc "chế độ `quiz` phải có đáp án" do backend kiểm tra theo `submission_mode` của quiz.
 */
export const submitQuizAttempt = (payload: {
	attemptId: string;
	answers?: Array<{ questionId: string; selectedOptionIds: string[] }>;
}) =>
	queryMethod.post('/submissions', payload) as Promise<
		DefaultResponseType<QuizSubmissionResult>
	>;

export const getSubmissionReview = (submissionId: string) =>
	queryMethod.get(`/submissions/${submissionId}/review`) as Promise<
		DefaultResponseType<SubmissionReview>
	>;

/** `GET /api/submissions/:id/files` — kèm cờ `allowUpload` do server quyết định. */
export const getSubmissionFiles = (submissionId: string) =>
	queryMethod.get(`/submissions/${submissionId}/files`) as Promise<
		DefaultResponseType<SubmissionFilesResponse>
	>;

/**
 * `POST /api/submissions/:id/files` — `multipart/form-data`, trường `file`.
 *
 * Cố ý **không** đặt `Content-Type` thủ công: trình duyệt phải tự thêm `boundary`, nếu tự đặt thì
 * server không tách được các phần của form (bài học đã ghi ở `apis/material`).
 *
 * Lỗi cần xử lý ở tầng trang: `413` (quá `MAX_UPLOAD_SIZE_MB`), `415` (sai định dạng),
 * `400` (quá trần số tệp), `409` (lượt đã nộp hoặc đã hết hạn).
 */
export const uploadSubmissionFile = (submissionId: string, file: File) => {
	const formData = new FormData();
	formData.append('file', file);

	return queryMethod.post(
		`/submissions/${submissionId}/files`,
		formData,
	) as Promise<DefaultResponseType<SubmissionFile>>;
};

/** `DELETE /api/submission-files/:id` — chỉ thành công khi lượt làm còn đang mở. */
export const deleteSubmissionFile = (fileId: string) =>
	queryMethod.delete(`/submission-files/${fileId}`) as Promise<
		DefaultResponseType<{ success: boolean }>
	>;

/**
 * `GET /api/submission-files/:id/download` — tệp bài nộp **cần** token, khác học liệu (`/uploads/**`
 * là tĩnh). Vì vậy không thể dùng `<a href>` trực tiếp: phải tải bằng axios rồi tạo blob URL, nếu
 * không trình duyệt sẽ mở một tab không có header `Authorization` và nhận `401`.
 */
export const downloadSubmissionFile = (fileId: string): Promise<Blob> =>
	queryMethod.get(`/submission-files/${fileId}/download`, {
		responseType: 'blob',
	}) as unknown as Promise<Blob>;
