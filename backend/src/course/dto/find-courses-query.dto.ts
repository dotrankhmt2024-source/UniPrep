import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { trimString } from '../../common/transformers/trim.transformer';
import {
	COURSE_LEVEL_LABEL,
	COURSE_LEVEL_VALUES,
	COURSE_STATUS_LABEL,
	COURSE_STATUS_VALUES,
	type CourseLevel,
	type CourseStatus,
} from '../../common/types';
import { COURSE_SORT_FIELDS, type CourseSortField } from '../types/course.type';

/**
 * Tách `?status=published,draft` thành mảng.
 *
 * Dùng chung cho cả trường hợp client gửi lặp tham số (`?status=a&status=b` → `string[]`): cả hai
 * cách đều phải cho ra cùng một mảng, nếu không thì hành vi phụ thuộc cách viết query.
 *
 * Khai `value: unknown` và ép kiểu ở từng nhánh: `class-transformer` truyền `any` vào transformer,
 * nên trả thẳng `value` sẽ bị ESLint bắt `no-unsafe-return` (cùng lý do `trim.transformer.ts` có
 * đúng một điểm ép kiểu).
 */
const toStatusList = ({ value }: { value: unknown }): unknown => {
	if (Array.isArray(value)) {
		return (value as unknown[]).flatMap((item): unknown[] =>
			typeof item === 'string' ? item.split(',') : [item],
		);
	}

	if (typeof value === 'string') {
		return value.split(',');
	}

	return value;
};

/**
 * `GET /api/courses` (E3-T1/E3-T3) — catalog có tìm kiếm, lọc và phân trang.
 *
 * Kế thừa `page`/`take`/`order`/`search` từ `PaginationQueryDto` (trần `take` được kiểm tra ở
 * **một** nơi). `status` nhận nhiều giá trị phân tách bằng dấu phẩy; mỗi phần tử vẫn phải nằm
 * trong union `CourseStatus` nên `@IsIn(..., { each: true })` được kiểm tra **sau** `@Transform`.
 *
 * Phạm vi hiển thị (`published` với học viên, thêm khoá mình phụ trách với giảng viên) **không**
 * nhận từ query: nó do `CourseAccessService.applyVisibilityScope` quyết định theo vai trò trong
 * token — client gửi thêm bộ lọc không mở rộng được quyền.
 */
export class FindCoursesQueryDto extends PaginationQueryDto {
	@ApiPropertyOptional({ description: 'Lọc theo danh mục (UUID v4).' })
	@IsOptional()
	@IsUUID('4', { message: 'Danh mục không hợp lệ.' })
	categoryId?: string;

	@ApiPropertyOptional({
		enum: COURSE_STATUS_VALUES,
		isArray: true,
		description: `Nhiều giá trị phân tách bằng dấu phẩy — ${COURSE_STATUS_VALUES.map(
			(status) => `${status}: ${COURSE_STATUS_LABEL[status]}`,
		).join(' · ')}`,
	})
	@IsOptional()
	@Transform(toStatusList)
	@IsIn(COURSE_STATUS_VALUES, {
		each: true,
		message: `Trạng thái khoá học không hợp lệ (chỉ nhận: ${COURSE_STATUS_VALUES.join(', ')}).`,
	})
	status?: CourseStatus[];

	@ApiPropertyOptional({ example: '1/2026-2027', maxLength: 20 })
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Học kỳ phải là chuỗi.' })
	@MaxLength(20, { message: 'Học kỳ tối đa 20 ký tự.' })
	semester?: string;

	@ApiPropertyOptional({
		description: 'Lọc theo giảng viên phụ trách chính (UUID v4).',
	})
	@IsOptional()
	@IsUUID('4', { message: 'Giảng viên phụ trách không hợp lệ.' })
	ownerId?: string;

	@ApiPropertyOptional({
		enum: COURSE_LEVEL_VALUES,
		description: COURSE_LEVEL_VALUES.map(
			(level) => `${level}: ${COURSE_LEVEL_LABEL[level]}`,
		).join(' · '),
	})
	@IsOptional()
	@IsIn(COURSE_LEVEL_VALUES, {
		message: `Trình độ không hợp lệ (chỉ nhận: ${COURSE_LEVEL_VALUES.join(', ')}).`,
	})
	level?: CourseLevel;

	@ApiPropertyOptional({
		enum: COURSE_SORT_FIELDS,
		default: 'createdAt',
		description:
			'Trường sắp xếp; `enrolledCount` sắp theo số học viên chưa huỷ ghi danh. Luôn có `id` làm khoá phụ để phân trang ổn định.',
	})
	@IsOptional()
	@IsIn(COURSE_SORT_FIELDS, {
		message: `Trường sắp xếp không hợp lệ (chỉ nhận: ${COURSE_SORT_FIELDS.join(', ')}).`,
	})
	sortBy: CourseSortField = 'createdAt';
}
