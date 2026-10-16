import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * `POST /api/auth/logout` (§5.3).
 *
 * `refreshToken` là tuỳ chọn: nếu client không gửi (hoặc gửi token không hợp lệ), server thu hồi
 * **mọi** phiên đang hoạt động của người dùng — hành vi an toàn hơn là bỏ qua yêu cầu.
 */
export class LogoutDto {
	@ApiPropertyOptional({
		description:
			'Refresh token của phiên cần kết thúc; bỏ trống để kết thúc mọi phiên',
	})
	@IsOptional()
	@IsString({ message: 'Refresh token phải là chuỗi.' })
	refreshToken?: string;
}
