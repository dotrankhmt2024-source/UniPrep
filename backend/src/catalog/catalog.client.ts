import type {
	CatalogOutline,
	CatalogPrerequisite,
	LocalizedText,
} from './catalog.types';

/** Một phiên bản đề cương — chưa kèm nội dung. */
export interface CatalogOutlineVersion {
	id: string;
	courseCode: string;
	version: string;
	appliesFrom: string | null;
	name: LocalizedText;
	credits: number | null;
	facultyCode: string | null;
}

export interface CatalogSearchQuery {
	/** Mã môn (khớp tiền tố) hoặc một phần tên tiếng Việt/Anh. */
	q?: string;
	facultyCode?: string;
	limit: number;
	offset: number;
}

export interface CatalogSearchResult {
	/** Mọi phiên bản của các môn trong trang này. */
	versions: CatalogOutlineVersion[];
	/** Tổng số **môn** khớp điều kiện (không phải số phiên bản). */
	totalCourses: number;
}

/**
 * Hợp đồng của Catalog service — nguồn nội dung môn học bên ngoài UniPrep.
 *
 * Phần còn lại của UniPrep chỉ phụ thuộc lớp trừu tượng này (cũng là token inject của Nest).
 * Bản hiện tại đọc thẳng DB của Catalog (`PgCatalogClient`); muốn tách thành HTTP service thì
 * thêm một cài đặt khác và đổi provider trong `CatalogModule`, không phải sửa nơi dùng.
 */
export abstract class CatalogClient {
	/** `false` khi thiếu cấu hình kết nối — gọi các hàm khác sẽ ném 503. */
	abstract get isConfigured(): boolean;

	abstract searchCourses(
		query: CatalogSearchQuery,
	): Promise<CatalogSearchResult>;

	abstract listVersions(courseCode: string): Promise<CatalogOutlineVersion[]>;

	/** Đề cương đầy đủ của một phiên bản cụ thể; `null` nếu không có. */
	abstract getOutline(
		courseCode: string,
		version: string,
	): Promise<CatalogOutline | null>;
}

export type { CatalogPrerequisite };
