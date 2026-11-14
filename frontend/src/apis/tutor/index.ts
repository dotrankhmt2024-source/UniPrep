import { queryMethod } from '@/config';
import type {
	DefaultResponseType,
	SendTutorMessagePayload,
	TutorSession,
	TutorSessionDetail,
	TutorTurnResult,
} from '@/types';

/** Agent có thể gọi model nhiều vòng; cho phép chờ lâu hơn mặc định 15 giây. */
const AGENT_TIMEOUT_MS = 5 * 60_000;

/** `GET /api/tutor/status` — backend đã có `DEEPSEEK_API_KEY` chưa. */
export const getTutorStatus = (): Promise<
	DefaultResponseType<{ configured: boolean }>
> =>
	queryMethod.get('/tutor/status') as Promise<
		DefaultResponseType<{ configured: boolean }>
	>;

/** `GET /api/tutor/sessions?courseId=` — cuộc trò chuyện gần đây của tôi. */
export const listTutorSessions = (
	courseId?: string,
): Promise<DefaultResponseType<TutorSession[]>> =>
	queryMethod.get('/tutor/sessions', { params: { courseId } }) as Promise<
		DefaultResponseType<TutorSession[]>
	>;

/** `GET /api/tutor/sessions/:id` — kèm toàn bộ trajectory. */
export const getTutorSession = (
	id: string,
): Promise<DefaultResponseType<TutorSessionDetail>> =>
	queryMethod.get(`/tutor/sessions/${id}`) as Promise<
		DefaultResponseType<TutorSessionDetail>
	>;

/** `DELETE /api/tutor/sessions/:id` */
export const deleteTutorSession = (
	id: string,
): Promise<DefaultResponseType<null>> =>
	queryMethod.delete(`/tutor/sessions/${id}`) as Promise<
		DefaultResponseType<null>
	>;

/** `POST /api/tutor/messages` — một lượt agent, có thể mất 10–60 giây. */
export const sendTutorMessage = (
	payload: SendTutorMessagePayload,
): Promise<DefaultResponseType<TutorTurnResult>> =>
	queryMethod.post('/tutor/messages', payload, {
		timeout: AGENT_TIMEOUT_MS,
	}) as Promise<DefaultResponseType<TutorTurnResult>>;
