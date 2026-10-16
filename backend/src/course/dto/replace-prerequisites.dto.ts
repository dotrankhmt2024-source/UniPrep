import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

/**
 * `PUT /api/courses/:id/prerequisites` (E3-T5) — thay **toàn bộ** danh sách tiên quyết.
 *
 * Là `PUT` (thay thế) chứ không phải `POST /prerequisites` (thêm): FE gửi một mảng là trạng thái
 * cuối cùng xác định, nên không có chuyện nửa vời khi người dùng bỏ chọn một khoá trong form.
 * Mảng rỗng hợp lệ = xoá hết tiên quyết.
 */
export class ReplacePrerequisitesDto {
	@ApiProperty({
		type: [String],
		example: ['c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f'],
		description:
			'Danh sách UUID v4 của các khoá tiên quyết; gửi `[]` để xoá hết.',
	})
	@IsArray({ message: 'Danh sách khoá tiên quyết phải là mảng.' })
	@IsUUID('4', {
		each: true,
		message: 'Mã khoá học tiên quyết không hợp lệ.',
	})
	courseIds: string[];
}
