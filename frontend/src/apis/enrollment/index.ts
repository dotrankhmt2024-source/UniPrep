import { queryMethod } from '@/config';
import type {
	CreateEnrollmentPayload,
	DefaultResponseType,
	MyEnrollmentSummary,
} from '@/types';

/**
 * Tầng gọi API ghi danh — **lát cắt tối thiểu từ E4-T1** dùng cho nút đăng ký của E3-T7.
 *
 * E4-T1 sẽ bổ sung phần còn lại (danh sách khoá đã đăng ký, huỷ ghi danh, tiến độ) vào chính
 * file này.
 */

/** `POST /api/enrollments` — backend trả `400` nếu thiếu điều kiện tiên quyết, `409` nếu đã đăng ký. */
export const enrollCourse = (
	payload: CreateEnrollmentPayload,
): Promise<DefaultResponseType<MyEnrollmentSummary>> =>
	queryMethod.post('/enrollments', payload) as Promise<
		DefaultResponseType<MyEnrollmentSummary>
	>;
