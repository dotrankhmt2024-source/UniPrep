import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
	USER_STATUS_LABEL,
	USER_STATUS_VALUES,
	type UserStatus,
} from '../../common/types';

/** `PATCH /api/users/:id/status` (E1-T5) — chỉ admin gọi được. */
export class UpdateUserStatusDto {
	@ApiProperty({
		enum: USER_STATUS_VALUES,
		example: 'suspended',
		description: USER_STATUS_VALUES.map(
			(status) => `${status}: ${USER_STATUS_LABEL[status]}`,
		).join(' · '),
	})
	@IsIn(USER_STATUS_VALUES, {
		message: `Trạng thái tài khoản không hợp lệ (chỉ nhận: ${USER_STATUS_VALUES.join(', ')}).`,
	})
	status: UserStatus;
}
