import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password.validator';

/** `POST /api/auth/reset-password` (§5.3). */
export class ResetPasswordDto {
	@ApiProperty({
		example: '4f2a9c1d8b3e5a7f0c6d2e4b8a1f3c5d',
		description: 'Token một lần nhận từ email (dev: ghi ra log của server)',
	})
	@IsString({ message: 'Token phải là chuỗi.' })
	@IsNotEmpty({ message: 'Token không được để trống.' })
	token: string;

	@ApiProperty({ example: 'Abcd@1234' })
	@IsStrongPassword()
	password: string;
}
