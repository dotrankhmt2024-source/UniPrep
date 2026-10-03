import type { PageMeta } from '../dto/page-meta.dto';

/**
 * Tiện ích phân trang dùng chung.
 *
 * **`itemCount` là TỔNG số bản ghi khớp điều kiện**, không phải số dòng của trang hiện tại — tên gọi
 * dễ gây nhầm nhưng đây là hợp đồng đã có sẵn ở `docs/02-specs/api-specification.md` §3.4 (`PageMetaDto`)
 * và frontend dựa vào nó: `ITable` truyền thẳng `meta.itemCount` vào `pagination.total` của antd
 * (§12, "ITable nhận `itemCount` cho phân trang server-side"). Nếu trả số dòng của trang thì bảng chỉ
 * có đúng một trang và người dùng không bao giờ lật sang trang 2 — lỗi đã suýt xảy ra ở E2-T5 vì phần
 * ví dụ JSON trong tài liệu trông giống "số dòng của trang".
 *
 * `pageCount` tối thiểu là **1** kể cả khi không có bản ghi nào (theo §3.4), để giao diện luôn có một
 * trang rỗng thay vì "0 trang".
 */
export const toSkip = (page: number, take: number): number => (page - 1) * take;

export const buildPageMeta = (
	total: number,
	page: number,
	take: number,
): PageMeta => ({
	page,
	take,
	itemCount: total,
	pageCount: take > 0 ? Math.max(1, Math.ceil(total / take)) : 1,
	hasPreviousPage: page > 1,
	hasNextPage: page * take < total,
});
