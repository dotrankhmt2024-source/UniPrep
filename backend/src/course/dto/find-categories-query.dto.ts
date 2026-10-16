import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
	CATEGORY_SORT_FIELDS,
	type CategorySortField,
} from '../types/course.type';

/**
 * `GET /api/categories` (E3-T3) — danh sách danh mục cho dropdown lọc ở catalog.
 *
 * `search` khớp `name`/`slug` không phân biệt hoa/thường; `sortBy` nằm trong danh sách **đóng** vì
 * tên cột không tham số hoá được trong `ORDER BY` (xem `USER_SORT_FIELDS` cho cùng lý do).
 */
export class FindCategoriesQueryDto extends PaginationQueryDto {
	@ApiPropertyOptional({
		enum: CATEGORY_SORT_FIELDS,
		default: 'name',
		description:
			'Trường sắp xếp; luôn có `id` làm khoá phụ để phân trang ổn định.',
	})
	@IsOptional()
	@IsIn(CATEGORY_SORT_FIELDS, {
		message: `Trường sắp xếp không hợp lệ (chỉ nhận: ${CATEGORY_SORT_FIELDS.join(', ')}).`,
	})
	sortBy: CategorySortField = 'name';
}
