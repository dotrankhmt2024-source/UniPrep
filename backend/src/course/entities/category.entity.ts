import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';

/**
 * Danh mục/khoa quản lý khoá học — `docs/02-specs/database-design.md` §3.2.1.
 *
 * Vì sao có `order_index` tách khỏi `name`: thứ tự hiển thị ở trang catalog là
 * quyết định của người quản trị, không suy ra được từ alphabet.
 * Vì sao có `is_active`: cần ẩn một danh mục khỏi catalog mà không xoá — xoá sẽ
 * làm `courses.category_id` bị `SET NULL` hàng loạt.
 */
@Entity('categories')
@Index('uq_categories_slug', ['slug'], { unique: true })
@Index('idx_categories_parent_order', ['parentId', 'orderIndex'])
export class Category extends BaseEntityCustom {
	@Column({ type: 'varchar', name: 'name', length: 150 })
	name: string;

	@Column({ type: 'varchar', name: 'slug', length: 180 })
	slug: string;

	@Column({ type: 'text', name: 'description', nullable: true })
	description: string | null;

	@Column({ type: 'uuid', name: 'parent_id', nullable: true })
	parentId: string | null;

	/**
	 * Self-FK theo §4.2: `SET NULL` để xoá danh mục cha không kéo theo danh mục con
	 * (chúng chỉ trở thành danh mục gốc) — dữ liệu khoá học không bị mất theo.
	 */
	@ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
	@JoinColumn({ name: 'parent_id' })
	parent: Category | null;

	/** Thứ tự hiển thị trong cùng cấp; mặc định 0 theo §3.2.1. */
	@Column({ type: 'integer', name: 'order_index', default: 0 })
	orderIndex: number;

	@Column({ type: 'boolean', name: 'is_active', default: true })
	isActive: boolean;
}
