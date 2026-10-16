import { ApiProperty } from '@nestjs/swagger';

/**
 * Metadata phân trang trả trong `data.meta`.
 *
 * Hình dạng này khớp **nguyên văn** `PageMetaDto` của frontend (`frontend/src/types/index.ts`) và ví
 * dụ trong `docs/02-specs/api-specification.md` — đổi một trường ở đây là vỡ `ITable` phía FE.
 */
export interface PageMeta {
	page: number;
	take: number;
	itemCount: number;
	pageCount: number;
	hasPreviousPage: boolean;
	hasNextPage: boolean;
}

export class PageMetaDto implements PageMeta {
	@ApiProperty({ example: 1 })
	page!: number;

	@ApiProperty({ example: 20 })
	take!: number;

	@ApiProperty({
		example: 35,
		description:
			'TỔNG số bản ghi khớp điều kiện (không phải số dòng của trang hiện tại) — frontend truyền thẳng giá trị này vào `pagination.total` của antd.',
	})
	itemCount!: number;

	@ApiProperty({
		example: 2,
		description:
			'Tổng số trang = ceil(itemCount / take), tối thiểu 1 kể cả khi không có bản ghi nào.',
	})
	pageCount!: number;

	@ApiProperty({ example: false })
	hasPreviousPage!: boolean;

	@ApiProperty({ example: true })
	hasNextPage!: boolean;
}
