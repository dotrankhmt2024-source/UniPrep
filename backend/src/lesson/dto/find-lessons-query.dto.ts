import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import {
	PAGE_ORDER_VALUES,
	PaginationQueryDto,
	type PageOrder,
} from '../../common/dto/pagination-query.dto';
import { trimString } from '../../common/transformers/trim.transformer';
import { LESSON_SORT_FIELDS, type LessonSortField } from '../types/lesson.type';

/**
 * `GET /api/courses/:courseId/lessons` (E3-T2).
 *
 * `order` được khai **lại** ở đây với mặc định `'asc'` (khác `'desc'` của `PaginationQueryDto`): danh
 * sách bài học là **lộ trình**, người học đọc từ bài 1 tới bài cuối. Nếu để mặc định `desc` của DTO
 * cha, một request không kèm `order` sẽ trả lộ trình đảo ngược và phá nút "bài kế tiếp" ở FE — lỗi
 * âm thầm vì response vẫn "hợp lệ".
 *
 * Bộ lọc theo chương và theo trạng thái công bố. Không dùng `@Type(() => Boolean)`: query string luôn
 * là chuỗi nên `?isPublished=false` sẽ thành `true` và **lọc ngược** ý người gọi — `@Transform` dưới
 * đây chỉ nhận đúng hai giá trị `'true'`/`'false'`, còn lại để `@IsBoolean` báo lỗi.
 */
export class FindLessonsQueryDto extends PaginationQueryDto {
	@ApiPropertyOptional({
		format: 'uuid',
		description: 'Chỉ lấy bài học thuộc chương này.',
	})
	@IsOptional()
	@Transform(trimString)
	sectionId?: string;

	@ApiPropertyOptional({
		type: Boolean,
		description:
			'Lọc theo trạng thái công bố. Học viên luôn bị ép `true` bất kể giá trị gửi lên.',
	})
	@IsOptional()
	@Transform(({ value }: { value: unknown }): unknown => {
		if (value === 'true' || value === true) return true;
		if (value === 'false' || value === false) return false;

		return value;
	})
	@IsBoolean({ message: 'Trạng thái công bố phải là true hoặc false.' })
	isPublished?: boolean;

	@ApiPropertyOptional({
		enum: PAGE_ORDER_VALUES,
		default: 'asc',
		description:
			'Thứ tự sắp xếp theo `sortBy`; mặc định `asc` vì danh sách bài học là lộ trình.',
	})
	@IsOptional()
	@IsIn(PAGE_ORDER_VALUES, {
		message: 'Thứ tự sắp xếp không hợp lệ (chỉ nhận: asc, desc).',
	})
	order: PageOrder = 'asc';

	@ApiPropertyOptional({
		enum: LESSON_SORT_FIELDS,
		default: 'orderIndex',
		description:
			'Trường sắp xếp; danh sách đóng vì tên cột đi thẳng vào `ORDER BY`. Luôn có `id` làm khoá phụ để phân trang ổn định.',
	})
	@IsOptional()
	@IsIn(LESSON_SORT_FIELDS, {
		message: `Trường sắp xếp không hợp lệ (chỉ nhận: ${LESSON_SORT_FIELDS.join(', ')}).`,
	})
	sortBy: LessonSortField = 'orderIndex';
}
