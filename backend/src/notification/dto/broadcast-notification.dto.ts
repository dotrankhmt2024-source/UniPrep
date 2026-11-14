import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ArrayMaxSize,
	IsArray,
	IsIn,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	MaxLength,
} from 'class-validator';
import { USER_ROLE_VALUES, type UserRole } from '../../common/types';

/**
 * `POST /api/notifications/broadcast` — admin phát thông báo hệ thống (`system`).
 * Thứ tự ưu tiên đối tượng nhận: `userIds` → `courseId` → `roles` → tất cả người dùng đang hoạt động.
 */
export class BroadcastNotificationDto {
	@ApiProperty({ example: 'Bảo trì hệ thống' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	title!: string;

	@ApiProperty({ example: 'Hệ thống sẽ bảo trì từ 22:00 đến 23:00 tối nay.' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(2000)
	body!: string;

	@ApiPropertyOptional({ enum: USER_ROLE_VALUES, isArray: true })
	@IsOptional()
	@IsArray()
	@IsIn(USER_ROLE_VALUES, { each: true })
	roles?: UserRole[];

	@ApiPropertyOptional({
		description: 'Chỉ gửi cho học viên đang học khoá này',
	})
	@IsOptional()
	@IsUUID('4')
	courseId?: string;

	@ApiPropertyOptional({ type: [String], description: 'Gửi đích danh' })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(1000)
	@IsUUID('4', { each: true })
	userIds?: string[];

	@ApiPropertyOptional({
		example: '/my-courses',
		description: 'Đường dẫn nội bộ của FE mở khi bấm vào thông báo',
	})
	@IsOptional()
	@IsString()
	@Matches(/^\/[^\s]*$/, {
		message: 'link phải là đường dẫn nội bộ bắt đầu bằng /',
	})
	@MaxLength(255)
	link?: string;
}
