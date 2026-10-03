import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { trimString } from '../../common/transformers/trim.transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * `POST /api/auth/login` (§5.3).
 *
 * Vì sao KHÔNG áp `@IsStrongPassword()` ở đây: mật khẩu cũ có thể được tạo trước khi chính sách
 * đổi. Nếu validate chính sách khi đăng nhập, người dùng hợp lệ sẽ nhận `400` thay vì `401` — vừa
 * sai ngữ nghĩa, vừa vô tình tiết lộ rằng mật khẩu gửi lên không khớp "hình dạng" nào đó.
 */
export class LoginDto {
	@ApiProperty({ example: 'sv2026001@hcmut.edu.vn' })
	@Transform(trimString)
	@IsEmail({}, { message: 'Email không đúng định dạng.' })
	@MaxLength(255, { message: 'Email tối đa 255 ký tự.' })
	email: string;

	@ApiProperty({ example: 'Abcd@1234', minLength: 1 })
	@IsString({ message: 'Mật khẩu phải là chuỗi.' })
	@MinLength(1, { message: 'Mật khẩu không được để trống.' })
	password: string;
}
