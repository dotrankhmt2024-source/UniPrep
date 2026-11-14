import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	MinLength,
} from 'class-validator';

/** `POST /api/tutor/messages` — một câu hỏi gửi trợ giảng AI. */
export class SendTutorMessageDto {
	@ApiPropertyOptional({
		description: 'Bỏ trống để mở cuộc trò chuyện mới',
		format: 'uuid',
	})
	@IsOptional()
	@IsUUID('4', { message: 'Cuộc trò chuyện không hợp lệ.' })
	sessionId?: string;

	@ApiProperty({
		description:
			'Khoá học mà trợ giảng đọc học liệu (phải trùng khoá của cuộc trò chuyện nếu có sessionId)',
		format: 'uuid',
	})
	@IsUUID('4', { message: 'Khoá học không hợp lệ.' })
	courseId: string;

	@ApiPropertyOptional({
		description:
			'Bài học người dùng đang xem (để trợ giảng ưu tiên tìm trong bài đó)',
		format: 'uuid',
	})
	@IsOptional()
	@IsUUID('4', { message: 'Bài học không hợp lệ.' })
	lessonId?: string;

	@ApiProperty({ maxLength: 2000 })
	@IsString({ message: 'Câu hỏi phải là chuỗi.' })
	@MinLength(1, { message: 'Câu hỏi không được để trống.' })
	@MaxLength(2000, { message: 'Câu hỏi tối đa 2000 ký tự.' })
	message: string;
}
