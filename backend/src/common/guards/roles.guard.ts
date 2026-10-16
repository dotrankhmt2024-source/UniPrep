import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { USER_ROLE_LABEL, type UserRole } from '../types';
import {
	FORBIDDEN_MESSAGE,
	UNAUTHENTICATED_MESSAGE,
} from '../constants/http-message.constant';
import type { AuthUser } from '../../auth/types/authenticated-user.type';

/**
 * Guard RBAC (E1-T3) — chạy sau `JwtAuthGuard` nên `request.user` đã có.
 *
 * Không có `@Roles()` ⇒ cho qua: đó là các endpoint "mọi vai trò đã đăng nhập" (ví dụ
 * `GET /api/auth/me`), khác hẳn với "công khai" (`@Public()`).
 */
@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
			ROLES_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (!requiredRoles?.length) return true;

		const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
		const user = request.user;

		if (!user) throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);

		if (!requiredRoles.includes(user.role)) {
			// Nêu rõ vai trò cần có: giúp dev phân biệt "sai vai trò" với "chưa đăng nhập" khi gọi API.
			throw new ForbiddenException(
				`${FORBIDDEN_MESSAGE} (yêu cầu vai trò: ${requiredRoles
					.map((role) => USER_ROLE_LABEL[role])
					.join(', ')})`,
			);
		}

		return true;
	}
}
