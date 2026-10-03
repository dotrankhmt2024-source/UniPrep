import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { trimString } from '../../common/transformers/trim.transformer';
import {
	IsEmail,
	IsOptional,
	IsString,
	Length,
	MaxLength,
} from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password.validator';

/** `POST /api/auth/register` (§5.3). */
export class RegisterDto {
	@ApiProperty({
		example: 'sv2026001@hcmut.edu.vn',
		description: 'Email đăng nhập, không phân biệt hoa/thường',
		maxLength: 255,
	})
	@Transform(trimString)
	@IsEmail({}, { message: 'Email không đúng định dạng.' })
	@MaxLength(255, { message: 'Email tối đa 255 ký tự.' })
	email: string;

	@ApiProperty({
		example: 'Abcd@1234',
		description:
			'Chính sách mật khẩu ở §5.1 (8–16 ký tự, hoa, thường, số, ký tự đặc biệt)',
	})
	@IsStrongPassword()
	password: string;

	@ApiProperty({ example: 'Nguyễn Văn A', minLength: 1, maxLength: 100 })
	@Transform(trimString)
	@IsString({ message: 'Họ tên phải là chuỗi.' })
	@Length(1, 100, { message: 'Họ tên phải có từ 1 đến 100 ký tự.' })
	fullName: string;

	@ApiPropertyOptional({
		example: 'SV2026001',
		description: 'Chỉ dùng khi tạo học viên; duy nhất nếu có',
		maxLength: 50,
	})
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Mã số sinh viên phải là chuỗi.' })
	@MaxLength(50, { message: 'Mã số sinh viên tối đa 50 ký tự.' })
	studentCode?: string;
}
