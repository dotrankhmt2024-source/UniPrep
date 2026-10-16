import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../../user/entities/user.entity';

/**
 * Lấy **entity `User`** do `LocalStrategy` trả về (chỉ dùng ở `POST /api/auth/login`).
 *
 * Vì sao cần decorator riêng thay vì dùng `@CurrentUser()`: sau khi đăng nhập, service cần dựng hồ
 * sơ trả về client (`fullName`, `avatarUrl`, `createdAt`, `updatedAt`) — những trường mà
 * `AuthUser` của request đã xác thực cố tình không mang (token chỉ chứa `id`/`email`/`role`).
 */
export const LocalUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): User => {
		const request = ctx.switchToHttp().getRequest<{ user?: User }>();
		return request.user as User;
	},
);
