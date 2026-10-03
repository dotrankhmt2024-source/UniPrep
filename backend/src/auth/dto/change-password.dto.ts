import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password.validator';

/** `POST /api/auth/change-password` (§5.3). */
export class ChangePasswordDto {
	@ApiProperty({ example: 'Abcd@1234' })
	@IsString({ message: 'Mật khẩu hiện tại phải là chuỗi.' })
	@IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống.' })
	currentPassword: string;

	@ApiProperty({ example: 'Xyz@9876' })
	@IsStrongPassword()
	newPassword: string;
}
