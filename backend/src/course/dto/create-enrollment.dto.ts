import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * Dữ liệu ghi danh (E3-T7 kéo tối thiểu từ E4-T1).
 *
 * `userId` **không** nằm trong DTO: người ghi danh luôn là người đang gọi
 * (`@CurrentUser()`), nhận `userId` từ body là mở đường cho IDOR — quy tắc nền ở
 * `api-specification.md` §6.
 */
export class CreateEnrollmentDto {
	@ApiProperty({ format: 'uuid', description: 'Khoá học muốn đăng ký.' })
	@IsUUID('4', { message: 'Mã khoá học không hợp lệ.' })
	courseId: string;

	@ApiPropertyOptional({
		format: 'uuid',
		nullable: true,
		description: 'Lớp (cohort) muốn vào; bỏ trống nghĩa là không gắn lớp.',
	})
	@IsOptional()
	@IsUUID('4', { message: 'Mã lớp không hợp lệ.' })
	cohortId?: string | null;
}
