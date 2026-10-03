import { queryMethod } from '@/config';
import type {
	Category,
	CreateCategoryPayload,
	DefaultResponseType,
	FindCategoriesParams,
	PaginatedCategories,
	UpdateCategoryPayload,
} from '@/types';

/**
 * Tầng gọi API danh mục (E3-T3).
 *
 * Cùng quy ước với `apis/user`: `queryMethod` đã bóc `response.data` nên hàm ở đây chỉ khai báo
 * kiểu cho `data`; trang hiển thị lỗi bằng `getApiErrorMessage(error)`.
 */

/** `GET /api/categories` — danh sách có tìm kiếm/phân trang, mọi vai trò đã đăng nhập đều đọc được. */
export const getCategories = (
	params: FindCategoriesParams = {},
): Promise<DefaultResponseType<PaginatedCategories>> =>
	queryMethod.get('/categories', { params }) as Promise<
		DefaultResponseType<PaginatedCategories>
	>;

/** `GET /api/categories/:id` */
export const getCategoryById = (
	id: string,
): Promise<DefaultResponseType<Category>> =>
	queryMethod.get(`/categories/${id}`) as Promise<
		DefaultResponseType<Category>
	>;

/** `POST /api/categories` — chỉ admin; `slug` bỏ trống thì backend tự sinh từ `name`. */
export const createCategory = (
	payload: CreateCategoryPayload,
): Promise<DefaultResponseType<Category>> =>
	queryMethod.post('/categories', payload) as Promise<
		DefaultResponseType<Category>
	>;

/** `PATCH /api/categories/:id` — chỉ admin. */
export const updateCategory = (
	id: string,
	payload: UpdateCategoryPayload,
): Promise<DefaultResponseType<Category>> =>
	queryMethod.patch(`/categories/${id}`, payload) as Promise<
		DefaultResponseType<Category>
	>;

/** `DELETE /api/categories/:id` — chỉ admin; `409` khi danh mục còn khoá học. */
export const deleteCategory = (
	id: string,
): Promise<DefaultResponseType<{ success: boolean }>> =>
	queryMethod.delete(`/categories/${id}`) as Promise<
		DefaultResponseType<{ success: boolean }>
	>;
