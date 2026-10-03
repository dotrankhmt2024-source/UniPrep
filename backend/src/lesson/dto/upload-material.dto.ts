import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../common/transformers/trim.transformer';

/**
 * Trường văn bản đi kèm multipart của `POST /api/lessons/:id/materials` (E3-T4).
 *
 * **Vì sao vẫn cần DTO dù chỉ có một trường:** `ValidationPipe` toàn cục bật `whitelist: true`, đi
 * qua DTO là cách duy nhất để `title` được kiểm tra độ dài và cắt khoảng trắng nhất quán với các DTO
 * khác của module.
 *
 * **Cảnh báo đã kiểm chứng (áp cho mọi DTO của endpoint multipart):** KHÔNG khai trường `file` ở đây
 * và không khai thêm trường nào không có thật trong form. Với `multipart/form-data`,
 * `class-transformer` không có metadata để loại trừ nên `whitelist: true` sẽ **gỡ luôn `file`** khỏi
 * body; multer vì thế không thấy tệp và request luôn trả `400` dù client gửi đúng. Tệp được lấy bằng
 * `@UploadedFile()` (do `FileInterceptor` gắn vào request), **không** qua DTO.
 */
export class UploadMaterialDto {
	@ApiPropertyOptional({
		maxLength: 255,
		description: 'Tiêu đề học liệu; bỏ trống thì lấy tên tệp gốc.',
	})
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Tiêu đề học liệu phải là chuỗi.' })
	@MaxLength(255, { message: 'Tiêu đề học liệu tối đa 255 ký tự.' })
	title?: string;
}
