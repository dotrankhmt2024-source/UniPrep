import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsEmail,
	IsNotEmpty,
	IsOptional,
	IsString,
} from 'class-validator';

export class CreateStudentDto {
	@ApiProperty({ example: 'Nguyễn Văn A', description: 'Họ tên sinh viên' })
	@IsString()
	@IsNotEmpty()
	fullName: string;

	@ApiProperty({ example: 'SV2026001', description: 'Mã số sinh viên' })
	@IsString()
	@IsNotEmpty()
	studentCode: string;

	@ApiProperty({
		example: 'sv2026001@hcmut.edu.vn',
		description: 'Email sinh viên',
	})
	@IsEmail()
	@IsNotEmpty()
	email: string;

	@ApiPropertyOptional({ example: '0901234567', description: 'Số điện thoại' })
	@IsString()
	@IsOptional()
	phone?: string;

	@ApiPropertyOptional({
		example: 'Khoa học máy tính',
		description: 'Ngành học',
	})
	@IsString()
	@IsOptional()
	major?: string;

	@ApiPropertyOptional({ default: true, description: 'Trạng thái hoạt động' })
	@IsBoolean()
	@IsOptional()
	isActive?: boolean;
}
