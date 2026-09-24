import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { buildError } from '../dto/api-response.dto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly fallbackMessages: Record<number, string> = {
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

	private normalizeMessage(status: number, rawMessage: string) {
		const message = (rawMessage || '').trim();
		if (!message) {
			return (
				this.fallbackMessages[status] ||
				this.fallbackMessages[HttpStatus.INTERNAL_SERVER_ERROR]
			);
		}
		return message;
	}

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response: {
			status: (code: number) => { json: (body: unknown) => void };
		} = ctx.getResponse();
		let status = HttpStatus.INTERNAL_SERVER_ERROR;
		let message = 'Lỗi hệ thống';

		if (exception instanceof HttpException) {
			status = exception.getStatus();
			const res = exception.getResponse();
			if (typeof res === 'string') message = res;
			else if (typeof res === 'object' && res !== null && 'message' in res) {
				const msg = (res as { message?: unknown }).message;
				if (typeof msg === 'string') {
					message = msg;
				} else if (
					Array.isArray(msg) &&
					msg.every((m) => typeof m === 'string')
				) {
					message = msg.join('; ');
				}
			}
		} else if (
			exception &&
			typeof exception === 'object' &&
			'message' in exception
		) {
			const exMsg = (exception as { message?: unknown }).message;
			if (typeof exMsg === 'string') message = exMsg;
		}

		response
			.status(status)
			.json(buildError(this.normalizeMessage(status, message)));
	}
}
