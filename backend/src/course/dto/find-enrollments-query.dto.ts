import { Transform } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsIn,
	IsOptional,
	IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const ENROLLMENT_STATUSES = [
	'active',
	'completed',
	'dropped',
	'expired',
] as const;
const ENROLLMENT_SORT_FIELDS = ['enrolledAt', 'progressPercent'] as const;

export class FindEnrollmentsQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsUUID('4', { message: 'Mã khoá học không hợp lệ.' })
	courseId?: string;

	@IsOptional()
	@IsUUID('4', { message: 'Mã học viên không hợp lệ.' })
	userId?: string;

	@IsOptional()
	@Transform(({ value }: { value: unknown }) =>
		typeof value === 'string' ? value.split(',') : value,
	)
	@IsArray({ message: 'Trạng thái ghi danh không hợp lệ.' })
	@ArrayMinSize(1, { message: 'Trạng thái ghi danh không hợp lệ.' })
	@IsIn(ENROLLMENT_STATUSES, {
		each: true,
		message: 'Trạng thái ghi danh không hợp lệ.',
	})
	status?: (typeof ENROLLMENT_STATUSES)[number][];

	@IsOptional()
	@IsIn(ENROLLMENT_SORT_FIELDS, { message: 'Trường sắp xếp không hợp lệ.' })
	sortBy: (typeof ENROLLMENT_SORT_FIELDS)[number] = 'enrolledAt';
}
