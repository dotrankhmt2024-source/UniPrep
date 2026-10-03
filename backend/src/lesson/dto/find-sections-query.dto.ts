import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * `GET /api/courses/:courseId/sections` (E3-T2).
 *
 * Kế thừa `page`/`take`/`order`/`search` nên trần `take` và kiểu số được kiểm tra ở **một** nơi
 * (`MAX_TAKE` của `PaginationQueryDto`) — không khai lại `page`/`take` ở đây.
 *
 * Không thêm trường nào: endpoint chỉ hỗ trợ `search` (khớp `title`) và `orderIndex ASC`. Lưu ý
 * mặc định `take` của riêng endpoint là **100** (xem `SECTION_DEFAULT_TAKE` trong service): một
 * khoá học thường có ít chương và FE cần đủ chương để dựng lộ trình trong một lần gọi.
 */
export class FindSectionsQueryDto extends PaginationQueryDto {}
