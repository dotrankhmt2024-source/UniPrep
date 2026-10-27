import { queryMethod } from '@/config';
import type {
	DefaultResponseType,
	InterventionRecord,
	MyNotificationsResponse,
	NotificationItem,
	RunPromptInterventionPayload,
	RunPromptInterventionResponse,
} from '@/types';

/**
 * `POST /api/interventions/run-prompt`
 * Giảng viên nhập prompt + chọn nhóm học viên và bấm "Kiểm tra".
 */
export const runPromptIntervention = (
	payload: RunPromptInterventionPayload,
): Promise<DefaultResponseType<RunPromptInterventionResponse>> =>
	queryMethod.post('/interventions/run-prompt', payload) as Promise<
		DefaultResponseType<RunPromptInterventionResponse>
	>;

/**
 * `GET /api/interventions/course/:courseId`
 * Lấy lịch sử các lần gửi thông báo can thiệp trong một khoá học.
 */
export const getCourseInterventions = (
	courseId: string,
): Promise<DefaultResponseType<{ items: InterventionRecord[] }>> =>
	queryMethod.get(`/interventions/course/${courseId}`) as Promise<
		DefaultResponseType<{ items: InterventionRecord[] }>
	>;

/**
 * `GET /api/notifications`
 * Lấy danh sách thông báo của người dùng hiện tại kèm số lượng chưa đọc (unreadCount).
 */
export const getMyNotifications = (): Promise<
	DefaultResponseType<MyNotificationsResponse>
> =>
	queryMethod.get('/notifications') as Promise<
		DefaultResponseType<MyNotificationsResponse>
	>;

/**
 * `PATCH /api/notifications/:id/read`
 * Đánh dấu 1 thông báo là đã đọc.
 */
export const markNotificationAsRead = (
	id: string,
): Promise<DefaultResponseType<NotificationItem>> =>
	queryMethod.patch(`/notifications/${id}/read`) as Promise<
		DefaultResponseType<NotificationItem>
	>;

/**
 * `PATCH /api/notifications/read-all`
 * Đánh dấu tất cả thông báo của người dùng hiện tại là đã đọc.
 */
export const markAllNotificationsAsRead = (): Promise<
	DefaultResponseType<{ updatedCount: number }>
> =>
	queryMethod.patch('/notifications/read-all') as Promise<
		DefaultResponseType<{ updatedCount: number }>
	>;