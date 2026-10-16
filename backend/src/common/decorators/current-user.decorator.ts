import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../../auth/types/authenticated-user.type';

/** Request đã đi qua `JwtAuthGuard` nên luôn có `user`. */
export type AuthenticatedRequest = Request & { user?: AuthUser };

/**
 * Lấy người dùng hiện tại từ token (không nhận `userId` từ query/body — §6 quy tắc nền của
 * api-specification: nhận `userId` từ client là mở đường cho IDOR).
 */
export const CurrentUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): AuthUser => {
		const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
		return request.user as AuthUser;
	},
);
