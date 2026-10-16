import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/**
 * Pipe dùng chung cho tham số đường dẫn là UUID v4.
 *
 * Vì sao cần `exceptionFactory`: message mặc định của Nest là tiếng Anh
 * (`Validation failed (uuid v4 is expected)`), trong khi toàn bộ API trả message tiếng Việt
 * (api-specification §4) — không thể để lọt một câu tiếng Anh chỉ vì tham số sai định dạng.
 */
export const UUID_V4_PIPE = new ParseUUIDPipe({
	version: '4',
	exceptionFactory: () => new BadRequestException('Mã định danh không hợp lệ.'),
});
