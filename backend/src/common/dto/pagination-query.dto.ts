import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';
import { trimString } from '../transformers/trim.transformer';

/**
 * Tham số phân trang dùng chung cho mọi endpoint danh sách.
 *
 * Vì sao tách thành DTO cha thay vì khai lại `page`/`take` ở từng endpoint: `take` phải có **trần**
 * (mặc định 100) — không có trần thì `?take=1000000` là một cách tự DoS bằng một request hợp lệ,
 * và mỗi endpoint tự khai sẽ có lúc quên. Endpoint cụ thể chỉ cần thêm `search`/`sortBy`/bộ lọc.
 *
 * Mọi trường đều có giá trị mặc định nên `GET /api/users` không kèm query vẫn trả trang đầu tiên;
 * `@Type(() => Number)` là bắt buộc vì query string luôn là chuỗi (`enableImplicitConversion`
 * không được bật trong `main.ts`).
 */

export const PAGE_ORDER_VALUES = ['asc', 'desc'] as const;
export type PageOrder = (typeof PAGE_ORDER_VALUES)[number];

export const DEFAULT_PAGE = 1;
export const DEFAULT_TAKE = 20;
/** Trần `take`: chặn client kéo cả bảng người dùng trong một request. */
export const MAX_TAKE = 100;

export class PaginationQueryDto {
	@ApiPropertyOptional({ default: DEFAULT_PAGE, minimum: 1, example: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'Số trang phải là số nguyên.' })
	@Min(1, { message: 'Số trang phải lớn hơn hoặc bằng 1.' })
	page: number = DEFAULT_PAGE;

	@ApiPropertyOptional({
		default: DEFAULT_TAKE,
		minimum: 1,
		maximum: MAX_TAKE,
		example: DEFAULT_TAKE,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'Số bản ghi mỗi trang phải là số nguyên.' })
	@Min(1, { message: 'Số bản ghi mỗi trang phải lớn hơn hoặc bằng 1.' })
	@Max(MAX_TAKE, {
		message: `Số bản ghi mỗi trang tối đa là ${MAX_TAKE}.`,
	})
	take: number = DEFAULT_TAKE;

	@ApiPropertyOptional({
		enum: PAGE_ORDER_VALUES,
		default: 'desc',
		description: 'Thứ tự sắp xếp theo trường `sortBy`.',
	})
	@IsOptional()
	@IsIn(PAGE_ORDER_VALUES, {
		message: 'Thứ tự sắp xếp không hợp lệ (chỉ nhận: asc, desc).',
	})
	order: PageOrder = 'desc';

	@ApiPropertyOptional({
		description:
			'Từ khoá tìm kiếm (tuỳ endpoint quyết định tìm trên trường nào).',
		maxLength: 100,
	})
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi.' })
	@MaxLength(100, { message: 'Từ khoá tìm kiếm tối đa 100 ký tự.' })
	search?: string;
}
