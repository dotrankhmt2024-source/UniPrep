import {
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UNAUTHENTICATED_MESSAGE } from '../constants/http-message.constant';
import type { AuthUser } from '../../auth/types/authenticated-user.type';

/**
 * Guard xác thực mặc định của **toàn bộ** API (E1-T3): mọi route đều bị chặn trừ khi handler/
 * controller có `@Public()`.
 *
 * Vì sao mặc định là "chặn" chứ không phải "cho qua": nếu guard chỉ gắn ở những controller cần
 * bảo vệ thì một controller mới thêm sẽ công khai ngoài ý muốn mà không ai phát hiện. Ở đây cái
 * quên sẽ gây 401 (ồn ào, phát hiện ngay khi test) chứ không phải rò rỉ dữ liệu (im lặng).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	constructor(private readonly reflector: Reflector) {
		super();
	}

	canActivate(context: ExecutionContext) {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) return true;

		return super.canActivate(context);
	}

	/**
	 * Passport trả `UnauthorizedException('Unauthorized')` mặc định — tiếng Anh và không khớp
	 * `fallbackMessages[401]` của `AllExceptionsFilter`. Ghi đè để client luôn nhận câu tiếng Việt
	 * đã chốt trong api-specification §4.
	 */
	handleRequest<TUser = AuthUser>(err: unknown, user: TUser): TUser {
		if (err || !user) {
			throw err instanceof Error
				? err
				: new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
		}
		return user;
	}
}
