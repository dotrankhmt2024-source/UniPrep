import { queryMethod } from '@/config';
import type {
	DefaultResponseType,
	FindCatalogCoursesParams,
	LearnerCatalogCourse,
	PageMetaDto,
	QuizScope,
} from '@/types';

/**
 * Thời gian chờ cho các request có thể kích hoạt AI sinh nội dung (mở bài học lần đầu, làm bài
 * tập lần đầu): model cần 10–60 giây, dài hơn nhiều so với mặc định 15 giây của axios.
 */
export const AI_GENERATION_TIMEOUT_MS = 3 * 60_000;

/** `GET /api/catalog/learning/courses` — mọi môn trong Catalog kèm trạng thái ghi danh của tôi. */
export const getCatalogCourses = (
	params: FindCatalogCoursesParams = {},
): Promise<
	DefaultResponseType<{ items: LearnerCatalogCourse[]; meta: PageMetaDto }>
> =>
	queryMethod.get('/catalog/learning/courses', { params }) as Promise<
		DefaultResponseType<{ items: LearnerCatalogCourse[]; meta: PageMetaDto }>
	>;

/** `POST /api/catalog/learning/courses/:code/open` — tạo khoá học từ đề cương (nếu chưa có). */
export const openCatalogCourse = (
	code: string,
): Promise<DefaultResponseType<{ courseId: string }>> =>
	queryMethod.post(
		`/catalog/learning/courses/${encodeURIComponent(code)}/open`,
		{},
		{ timeout: 60_000 },
	) as Promise<DefaultResponseType<{ courseId: string }>>;

/** `GET /api/catalog/learning/courses/:courseId/quiz-scope` — các bài của khoá kèm tiến độ của tôi. */
export const getQuizScope = (
	courseId: string,
): Promise<DefaultResponseType<QuizScope>> =>
	queryMethod.get(
		`/catalog/learning/courses/${courseId}/quiz-scope`,
	) as Promise<DefaultResponseType<QuizScope>>;

/** `POST /api/catalog/learning/courses/:courseId/custom-quizzes` — AI ra quiz cá nhân từ các bài đã chọn. */
export const createCustomQuiz = (
	courseId: string,
	payload: { lessonIds: string[]; questionCount?: number },
): Promise<DefaultResponseType<{ quizId: string }>> =>
	queryMethod.post(
		`/catalog/learning/courses/${courseId}/custom-quizzes`,
		payload,
		{ timeout: AI_GENERATION_TIMEOUT_MS },
	) as Promise<DefaultResponseType<{ quizId: string }>>;
