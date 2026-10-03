import { HttpStatus } from '@nestjs/common';

/**
 * Message tiếng Việt dùng chung cho tầng HTTP (đặc tả `docs/02-specs/api-specification.md` §4).
 *
 * Vì sao gom vào một chỗ: `AllExceptionsFilter` (fallback theo status) và các guard
 * (`JwtAuthGuard`, `RolesGuard`) phải phát **cùng một câu** cho cùng một tình huống — nếu mỗi nơi
 * tự viết chuỗi thì chỉ cần sửa một nơi là client nhận hai message khác nhau cho cùng lỗi 401.
 */
export const HTTP_FALLBACK_MESSAGES: Record<number, string> = {
	[HttpStatus.BAD_REQUEST]: 'Dữ liệu gửi lên không hợp lệ.',
	[HttpStatus.UNAUTHORIZED]: 'Bạn chưa đăng nhập hoặc phiên đã hết hạn.',
	[HttpStatus.FORBIDDEN]: 'Bạn không có quyền thực hiện thao tác này.',
	[HttpStatus.NOT_FOUND]: 'Không tìm thấy dữ liệu yêu cầu.',
	[HttpStatus.CONFLICT]: 'Dữ liệu đang xung đột, vui lòng kiểm tra lại.',
	[HttpStatus.TOO_MANY_REQUESTS]:
		'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
	[HttpStatus.INTERNAL_SERVER_ERROR]:
		'Hệ thống đang bận. Vui lòng thử lại sau.',
};

export const UNAUTHENTICATED_MESSAGE =
	HTTP_FALLBACK_MESSAGES[HttpStatus.UNAUTHORIZED];

export const FORBIDDEN_MESSAGE = HTTP_FALLBACK_MESSAGES[HttpStatus.FORBIDDEN];
