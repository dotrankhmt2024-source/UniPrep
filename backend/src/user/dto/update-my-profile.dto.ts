import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	MinLength,
} from 'class-validator';
import { trimString } from '../../common/transformers/trim.transformer';

/**
 * `PATCH /api/users/me` (E2-T1) — người dùng tự sửa hồ sơ của mình.
 *
 * **Vì sao không có `role`/`status`/`email`:** `ValidationPipe` toàn cục bật `whitelist: true`
 * (`main.ts`), nên mọi trường không khai báo trong DTO bị **loại bỏ trước khi** tới service. Đây là
 * cách chặn leo thang đặc quyền (`{"role":"admin"}`) ở tầng khung, không phụ thuộc việc service có
 * nhớ bỏ qua trường đó hay không — chính là DoD của E2-T1.
 *
 * Mọi trường đều tuỳ chọn: chỉ trường nào client gửi lên mới được cập nhật (PATCH đúng nghĩa).
 * Gửi `null` để **xoá** một trường (ví dụ bỏ số điện thoại) — `@IsOptional()` cho `null` đi qua.
 */
export class UpdateMyProfileDto {
	@ApiPropertyOptional({ example: 'Nguyễn Văn An', maxLength: 255 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Họ và tên phải là chuỗi.' })
	@MinLength(2, { message: 'Họ và tên phải có ít nhất 2 ký tự.' })
	@MaxLength(255, { message: 'Họ và tên tối đa 255 ký tự.' })
	fullName?: string;

	@ApiPropertyOptional({
		example: '0907654321',
		nullable: true,
		description:
			'Số điện thoại Việt Nam (10 số, hoặc +84...) — gửi null để xoá.',
	})
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Số điện thoại phải là chuỗi.' })
	@Matches(/^(?:\+84|0)\d{9}$/, {
		message: 'Số điện thoại không hợp lệ (ví dụ: 0901234567).',
	})
	phone?: string | null;

	@ApiPropertyOptional({ example: 'Kỹ thuật phần mềm', maxLength: 255 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Ngành học phải là chuỗi.' })
	@MaxLength(255, { message: 'Ngành học tối đa 255 ký tự.' })
	major?: string | null;

	@ApiPropertyOptional({
		example: 'Sinh viên năm 3',
		maxLength: 1000,
		description: 'Giới thiệu ngắn — gửi null để xoá.',
	})
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Giới thiệu phải là chuỗi.' })
	@MaxLength(1000, { message: 'Giới thiệu tối đa 1000 ký tự.' })
	bio?: string | null;
}
