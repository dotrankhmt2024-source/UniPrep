import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { trimString } from '../../common/transformers/trim.transformer';
import { IsEmail, MaxLength } from 'class-validator';

/** `POST /api/auth/forgot-password` (§5.3). */
export class ForgotPasswordDto {
	@ApiProperty({ example: 'sv2026001@hcmut.edu.vn' })
	@Transform(trimString)
	@IsEmail({}, { message: 'Email không đúng định dạng.' })
	@MaxLength(255, { message: 'Email tối đa 255 ký tự.' })
	email: string;
}
