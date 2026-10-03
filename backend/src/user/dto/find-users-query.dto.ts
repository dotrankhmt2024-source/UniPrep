import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
	USER_ROLE_LABEL,
	USER_ROLE_VALUES,
	USER_STATUS_LABEL,
	USER_STATUS_VALUES,
	type UserRole,
	type UserStatus,
} from '../../common/types';
import { USER_SORT_FIELDS, type UserSortField } from '../types/user.type';

/**
 * `GET /api/users` (E2-T2) — danh sách người dùng cho quản trị.
 *
 * `search` khớp `email`, `fullName` hoặc `studentCode` (không phân biệt hoa/thường). Kế thừa
 * `page`/`take`/`order`/`search` từ `PaginationQueryDto` nên trần `take` và kiểu số được kiểm tra
 * ở **một** nơi.
 */
export class FindUsersQueryDto extends PaginationQueryDto {
	@ApiPropertyOptional({
		enum: USER_ROLE_VALUES,
		description: USER_ROLE_VALUES.map(
			(role) => `${role}: ${USER_ROLE_LABEL[role]}`,
		).join(' · '),
	})
	@IsOptional()
	@IsIn(USER_ROLE_VALUES, {
		message: `Vai trò không hợp lệ (chỉ nhận: ${USER_ROLE_VALUES.join(', ')}).`,
	})
	role?: UserRole;

	@ApiPropertyOptional({
		enum: USER_STATUS_VALUES,
		description: USER_STATUS_VALUES.map(
			(status) => `${status}: ${USER_STATUS_LABEL[status]}`,
		).join(' · '),
	})
	@IsOptional()
	@IsIn(USER_STATUS_VALUES, {
		message: `Trạng thái tài khoản không hợp lệ (chỉ nhận: ${USER_STATUS_VALUES.join(', ')}).`,
	})
	status?: UserStatus;

	@ApiPropertyOptional({
		enum: USER_SORT_FIELDS,
		default: 'createdAt',
		description:
			'Trường sắp xếp; luôn có `id` làm khoá phụ để phân trang ổn định.',
	})
	@IsOptional()
	@IsIn(USER_SORT_FIELDS, {
		message: `Trường sắp xếp không hợp lệ (chỉ nhận: ${USER_SORT_FIELDS.join(', ')}).`,
	})
	sortBy: UserSortField = 'createdAt';
}
