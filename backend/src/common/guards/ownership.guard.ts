import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OWN_RESOURCE_PARAM_KEY } from '../decorators/own-resource.decorator';
import { UNAUTHENTICATED_MESSAGE } from '../constants/http-message.constant';
import type { AuthUser } from '../../auth/types/authenticated-user.type';

/**
 * Guard chống IDOR (E1-T6): với route có `@OwnResource('id')`, chỉ **chính chủ** hoặc `admin`
 * được đi qua.
 *
 * Vì sao trả 403 chứ không 404: theo cột `student` của ma trận RBAC trong api-specification §6,
 * truy cập dữ liệu người khác là "✖" (bị từ chối) — tức 403. Chọn 404 cũng hợp lệ về bảo mật
 * (không lộ sự tồn tại của bản ghi), nhưng khi đó client không phân biệt được "không có quyền"
 * với "không tồn tại" và FE sẽ hiển thị sai thông báo.
 *
 * Phạm vi dữ liệu của giảng viên ("assigned") chưa nằm ở đây: nó cần dữ liệu `courses.teacher_id`
 * của E3, sẽ bổ sung cùng lúc với `CourseModule` (xem ghi chú trong implementation-plan E1-T6).
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const paramName = this.reflector.getAllAndOverride<string>(
			OWN_RESOURCE_PARAM_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (!paramName) return true;

		const request = context
			.switchToHttp()
			.getRequest<{ user?: AuthUser; params: Record<string, string> }>();
		const user = request.user;

		if (!user) throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
		if (user.role === 'admin') return true;

		if (request.params?.[paramName] !== user.id) {
			throw new ForbiddenException(
				'Bạn không có quyền truy cập dữ liệu của người dùng khác.',
			);
		}

		return true;
	}
}
