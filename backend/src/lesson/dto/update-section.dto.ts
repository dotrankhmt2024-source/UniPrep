import { PartialType } from '@nestjs/swagger';
import { CreateSectionDto } from './create-section.dto';

/**
 * `PATCH /api/sections/:id` (E3-T2) — mọi trường đều tuỳ chọn.
 *
 * Dùng `PartialType` thay vì khai lại `@IsOptional()` cho từng trường: nếu không, hai DTO sẽ lệch
 * nhau ngay lần đầu ai đó sửa ràng buộc độ dài ở `CreateSectionDto`, và tài liệu Swagger cũng không
 * còn khớp.
 *
 * Quy tắc `published_at` (đặt khi `true`, xoá khi `false`) nằm ở **service**, không ở DTO: nó phụ
 * thuộc trạng thái hiện tại của bản ghi nên không thể diễn đạt bằng validation.
 */
export class UpdateSectionDto extends PartialType(CreateSectionDto) {}
