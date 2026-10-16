import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** `POST /api/auth/refresh` (§5.3). */
export class RefreshTokenDto {
	@ApiProperty({
		example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
		description: 'Refresh token nhận được từ lần đăng nhập/refresh trước đó',
	})
	@IsString({ message: 'Refresh token phải là chuỗi.' })
	@IsNotEmpty({ message: 'Refresh token không được để trống.' })
	refreshToken: string;
}
