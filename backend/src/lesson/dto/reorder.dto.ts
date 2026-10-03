import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsInt,
	IsUUID,
	Min,
	ValidateNested,
} from 'class-validator';

/**
 * Một mục trong payload sắp xếp lại.
 *
 * Dùng chung cho `PATCH /api/courses/:courseId/sections/reorder` và
 * `PATCH /api/sections/:sectionId/lessons/reorder` — hai endpoint có **cùng** hợp đồng, chỉ khác
 * phạm vi bản ghi, nên tách `ReorderItemDto` để ràng buộc `orderIndex >= 1` chỉ được khai một lần.
 */
export class ReorderItemDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID('4', { message: 'ID trong danh sách sắp xếp không hợp lệ.' })
	id!: string;

	@ApiProperty({ minimum: 1, example: 1 })
	@Type(() => Number)
	@IsInt({ message: 'Thứ tự phải là số nguyên.' })
	@Min(1, { message: 'Thứ tự phải lớn hơn hoặc bằng 1.' })
	orderIndex!: number;
}

/**
 * Payload sắp xếp lại.
 *
 * `@ValidateNested({ each: true })` + `@Type(() => ReorderItemDto)` là **bắt buộc**: thiếu `@Type`
 * thì `class-transformer` giữ nguyên object thô và `whitelist: true` của `ValidationPipe` toàn cục sẽ
 * **xoá sạch** `id`/`orderIndex` bên trong (đã gặp ở E2 với DTO lồng nhau), khiến payload hợp lệ
 * trở thành mảng các object rỗng.
 */
export class ReorderDto {
	@ApiProperty({ type: [ReorderItemDto] })
	@IsArray({ message: 'Danh sách sắp xếp phải là một mảng.' })
	@ArrayMinSize(1, { message: 'Danh sách sắp xếp không được rỗng.' })
	@ValidateNested({ each: true })
	@Type(() => ReorderItemDto)
	items!: ReorderItemDto[];
}
