import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { SessionContext } from '../../auth/token.service';

/**
 * Lấy thông tin phiên (IP, User-Agent) để ghi vào `refresh_tokens` / `password_reset_tokens`.
 *
 * IP **không bao giờ được lưu thô** — `TokenService.hashIp` băm trước khi ghi (database-design
 * §3.1.2, §11: giảm dữ liệu cá nhân nếu DB bị lộ).
 */
export const SessionInfo = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): SessionContext => {
		const request = ctx.switchToHttp().getRequest<Request>();
		const userAgent = request.headers['user-agent'];

		return {
			ip: request.ip ?? null,
			userAgent: typeof userAgent === 'string' ? userAgent : null,
		};
	},
);
