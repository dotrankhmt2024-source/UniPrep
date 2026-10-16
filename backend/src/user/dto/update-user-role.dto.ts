import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
	USER_ROLE_LABEL,
	USER_ROLE_VALUES,
	type UserRole,
} from '../../common/types';

/** `PATCH /api/users/:id/role` (E2-T2) — chỉ admin gọi được. */
export class UpdateUserRoleDto {
	@ApiProperty({
		enum: USER_ROLE_VALUES,
		example: 'teacher',
		description: USER_ROLE_VALUES.map(
			(role) => `${role}: ${USER_ROLE_LABEL[role]}`,
		).join(' · '),
	})
	@IsIn(USER_ROLE_VALUES, {
		message: `Vai trò không hợp lệ (chỉ nhận: ${USER_ROLE_VALUES.join(', ')}).`,
	})
	role: UserRole;
}
