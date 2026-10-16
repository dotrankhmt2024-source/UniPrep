import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { Category } from './entities/category.entity';
import { COURSE_MESSAGE } from './constants/course-message.constant';
import { buildPageMeta, toSkip } from '../common/utils/pagination.util';
import { resolveUniqueSlug, slugify } from './course.util';
import { toCategoryItem } from './course.mapper';
import type { FindCategoriesQueryDto } from './dto/find-categories-query.dto';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';
import type { CategorySortField } from './types/course.type';
import type { CategoryItem, PaginatedCategories } from './types/course.type';

/**
 * Cột dùng cho `ORDER BY`. Bảng ánh xạ **đóng** thay vì nội suy `sortBy` vào SQL — tên cột không
 * tham số hoá được nên nhận chuỗi tự do từ query là lỗ hổng SQL injection.
 */
const SORT_COLUMN: Record<CategorySortField, string> = {
	name: 'category.name',
	createdAt: 'category.createdAt',
};

/** Mã lỗi Postgres cho vi phạm ràng buộc duy nhất. */
const UNIQUE_VIOLATION_CODE = '23505';

/**
 * `driverError` của `pg` chỉ được khai là `Error`, nên các trường `code`/`constraint` phải đọc qua
 * kiểu giao (`Error & {...}`) — `QueryFailedError` đòi tham số generic thoả `Error`.
 */
type PgDriverError = Error & { code?: string; constraint?: string };

const driverError = (error: unknown): PgDriverError | undefined =>
	error instanceof QueryFailedError
		? (error.driverError as PgDriverError)
		: undefined;

const isUniqueViolation = (error: unknown): boolean =>
	driverError(error)?.code === UNIQUE_VIOLATION_CODE;

/**
 * Tên index duy nhất mà Postgres báo về khi chèn/ghi đè trùng danh mục.
 *
 * **Vì sao phải đọc tên index thay vì trả `409` cho mọi lỗi `23505`:** `categories` có duy nhất
 * một ràng buộc (`uq_categories_slug`) nên hiện tại chỉ có một thông điệp; nhưng đọc tên index
 * giữ cho hàm dịch lỗi đúng cả khi bảng có thêm ràng buộc duy nhất khác.
 */
const CONSTRAINT_MESSAGE: Record<string, string> = {
	uq_categories_slug: COURSE_MESSAGE.categoryExists,
};

/**
 * Danh mục/khoa quản lý khoá học (E3-T3).
 *
 * **Vì sao kiểm tra trùng vẫn phải kèm `try/catch` dù đã `count` trước:** `count` và `INSERT` là
 * hai câu lệnh rời nhau — hai admin cùng bấm "Tạo" trong cùng một giây đều vượt qua `count`, và
 * request thứ hai nhận lỗi Postgres thô (`QueryFailedError`) thay vì `409` có thông điệp tiếng
 * Việt. Lưới an toàn `23505` là thứ biến "đua" thành cùng một hợp đồng lỗi.
 */
@Injectable()
export class CategoryService {
	constructor(
		@InjectRepository(Category)
		private readonly categories: Repository<Category>,
		@InjectRepository(Course)
		private readonly courses: Repository<Course>,
	) {}

	/**
	 * `GET /api/categories` (E3-T3).
	 *
	 * `courseCount` được tính bằng **một** truy vấn gộp cho cả trang (`GROUP BY category_id`), không
	 * phải một `count` cho mỗi dòng: với `take = 100` cách viết N+1 là 100 vòng round-trip tới DB
	 * cho một request danh sách.
	 */
	async findMany(query: FindCategoriesQueryDto): Promise<PaginatedCategories> {
		const { page, take, order, search, sortBy } = query;

		const builder = this.categories.createQueryBuilder('category');

		if (search) {
			// `LOWER(...) LIKE :keyword` khớp cách `UserService` tìm kiếm: cùng kết quả với `ILIKE`
			// nhưng không phụ thuộc cú pháp riêng của Postgres.
			builder.andWhere(
				`(LOWER(category.name) LIKE :keyword OR LOWER(category.slug) LIKE :keyword)`,
				{ keyword: `%${search.toLowerCase()}%` },
			);
		}

		const [rows, total] = await builder
			.orderBy(SORT_COLUMN[sortBy], order.toUpperCase() as 'ASC' | 'DESC')
			.addOrderBy('category.id', 'ASC')
			.skip(toSkip(page, take))
			.take(take)
			.getManyAndCount();

		const courseCounts = await this.countCoursesByCategory(
			rows.map((row) => row.id),
		);

		return {
			items: rows.map((row) =>
				toCategoryItem(row, courseCounts.get(row.id) ?? 0),
			),
			// `itemCount` là TỔNG số bản ghi khớp điều kiện (không phải số dòng của trang) — xem
			// ghi chú "trap" trong `pagination.util.ts`.
			meta: buildPageMeta(total, page, take),
		};
	}

	/** `GET /api/categories/:id` (E3-T3). */
	async findOne(id: string): Promise<CategoryItem> {
		const category = await this.findCategoryOrFail(id);
		const courseCounts = await this.countCoursesByCategory([id]);

		return toCategoryItem(category, courseCounts.get(id) ?? 0);
	}

	/** `POST /api/categories` (E3-T3) — chỉ `admin`. */
	async create(dto: CreateCategoryDto): Promise<CategoryItem> {
		await this.assertNameAvailable(dto.name);
		const slug = await this.resolveSlug(dto.slug, slugify(dto.name));

		const category = this.categories.create({
			name: dto.name,
			slug,
			description: dto.description ?? null,
			parentId: dto.parentId ?? null,
			orderIndex: dto.orderIndex ?? 0,
			isActive: dto.isActive ?? true,
		});

		try {
			const saved = await this.categories.save(category);
			return toCategoryItem(saved, 0);
		} catch (error) {
			this.rethrowDuplicate(error);
			throw error;
		}
	}

	/** `PATCH /api/categories/:id` (E3-T3) — chỉ `admin`. */
	async update(id: string, dto: UpdateCategoryDto): Promise<CategoryItem> {
		const category = await this.findCategoryOrFail(id);

		if (dto.parentId !== undefined && dto.parentId !== null) {
			// Danh mục là cha của chính nó sẽ tạo vòng trong cây phân cấp và làm mọi truy vấn đệ quy
			// sau này (E3-T3 chỉ dựng cây một cấp) lặp vô hạn.
			if (dto.parentId === id) {
				throw new ConflictException(COURSE_MESSAGE.categoryExists);
			}

			await this.findCategoryOrFail(dto.parentId);
		}

		if (dto.name !== undefined) {
			await this.assertNameAvailable(dto.name, id);
		}

		// `slug` chỉ được sinh lại khi client đổi `name` mà không gửi `slug`: đổi slug tự động mỗi
		// lần sửa mô tả sẽ phá các URL đã chia sẻ.
		let slug = dto.slug;
		if (
			slug === undefined &&
			dto.name !== undefined &&
			dto.name !== category.name
		) {
			slug = await this.resolveSlug(undefined, slugify(dto.name), id);
		} else if (slug !== undefined) {
			slug = await this.resolveSlug(slug, slug, id);
		}

		const changes: Partial<Category> = {};
		if (dto.name !== undefined) changes.name = dto.name;
		if (slug !== undefined) changes.slug = slug;
		if (dto.description !== undefined) changes.description = dto.description;
		if (dto.parentId !== undefined) changes.parentId = dto.parentId;
		if (dto.orderIndex !== undefined) changes.orderIndex = dto.orderIndex;
		if (dto.isActive !== undefined) changes.isActive = dto.isActive;

		if (Object.keys(changes).length > 0) {
			try {
				await this.categories.update({ id }, changes);
			} catch (error) {
				this.rethrowDuplicate(error);
				throw error;
			}
		}

		return this.findOne(id);
	}

	/**
	 * `DELETE /api/categories/:id` (E3-T3) — xoá cứng, nhưng chỉ khi không còn khoá học tham chiếu.
	 *
	 * **Vì sao chặn thay vì xoá:** FK `courses.category_id → categories.id` là `ON DELETE SET NULL`
	 * (§4.2), nên xoá danh mục sẽ **âm thầm** gỡ phân loại của hàng loạt khoá học — dữ liệu mất mà
	 * không có dấu vết. `409` buộc người quản trị chuyển khoá học sang danh mục khác trước.
	 */
	async remove(id: string): Promise<void> {
		await this.findCategoryOrFail(id);

		const referenced = await this.countCoursesByCategory([id]);
		if ((referenced.get(id) ?? 0) > 0) {
			throw new ConflictException(COURSE_MESSAGE.categoryHasCourses);
		}

		await this.categories.delete({ id });
	}

	async findCategoryOrFail(id: string): Promise<Category> {
		const category = await this.categories.findOne({ where: { id } });

		if (!category) {
			throw new NotFoundException(COURSE_MESSAGE.categoryNotFound(id));
		}

		return category;
	}

	/**
	 * Đếm khoá học (chưa xoá mềm) theo `category_id` cho **một tập** id.
	 *
	 * Trả `Map` để nơi gọi không phải tự ghép cặp; id không có khoá học sẽ không xuất hiện trong
	 * map, nơi gọi dùng `?? 0`.
	 */
	private async countCoursesByCategory(
		categoryIds: string[],
	): Promise<Map<string, number>> {
		if (categoryIds.length === 0) return new Map();

		const rows = await this.courses
			.createQueryBuilder('course')
			.select('course.categoryId', 'category_id')
			.addSelect('COUNT(course.id)', 'total')
			.where('course.categoryId IN (:...categoryIds)', { categoryIds })
			.andWhere('course.deletedAt IS NULL')
			.groupBy('course.categoryId')
			.getRawMany<{ category_id: string; total: string }>();

		return new Map(rows.map((row) => [row.category_id, Number(row.total)]));
	}

	/** Trùng `name` không phân biệt hoa/thường — người dùng coi "Toán" và "toán" là một danh mục. */
	private async assertNameAvailable(
		name: string,
		exceptId?: string,
	): Promise<void> {
		const builder = this.categories
			.createQueryBuilder('category')
			.where('LOWER(category.name) = LOWER(:name)', { name });

		if (exceptId) {
			builder.andWhere('category.id <> :exceptId', { exceptId });
		}

		if (await builder.getExists()) {
			throw new ConflictException(COURSE_MESSAGE.categoryExists);
		}
	}

	/**
	 * Chọn slug cuối cùng: dùng `requested` (đã trim) nếu client gửi, ngược lại dùng `fallback`
	 * sinh từ tên; sau đó mới thêm hậu tố chống trùng.
	 */
	private async resolveSlug(
		requested: string | undefined,
		fallback: string,
		exceptId?: string,
	): Promise<string> {
		const base = requested && requested.length > 0 ? requested : fallback;

		return resolveUniqueSlug(this.categories, base, exceptId);
	}

	/** Dịch lỗi vi phạm ràng buộc duy nhất thành `409` có thông điệp tiếng Việt. */
	private rethrowDuplicate(error: unknown): void {
		if (!isUniqueViolation(error)) return;

		const constraint = driverError(error)?.constraint;

		throw new ConflictException(
			CONSTRAINT_MESSAGE[constraint ?? ''] ?? COURSE_MESSAGE.categoryExists,
		);
	}
}
