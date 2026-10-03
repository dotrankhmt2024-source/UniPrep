import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { buildError } from '../dto/api-response.dto';
import { HTTP_FALLBACK_MESSAGES } from '../constants/http-message.constant';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	/**
	 * Message dùng chung với các guard (xem `common/constants/http-message.constant.ts`) — 401 do
	 * guard ném ra và 401 do filter sinh ra phải là **cùng một câu**.
	 */
	private readonly fallbackMessages = HTTP_FALLBACK_MESSAGES;

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
