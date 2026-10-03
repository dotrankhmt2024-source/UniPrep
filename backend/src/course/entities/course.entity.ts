import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import {
	CourseLevel,
	CourseStatus,
	CourseVisibility,
} from '../../common/types';
import { User } from '../../user/entities/user.entity';
import { Category } from './category.entity';

/**
 * Khoá học — thực thể trung tâm của nội dung (`docs/02-specs/database-design.md`
 * §3.2.2), viết theo mẫu §8.3.
 *
 * Vì sao KHÔNG có `@OneToMany`: quy ước của task chỉ khai báo phía sở hữu quan hệ
 * (`@Column` + `@ManyToOne` + `@JoinColumn`) — một FK chỉ có một nguồn chân lý, và
 * tránh phải import ngược các module khác chỉ để lấy danh sách con.
 *
 * Vì sao không lưu trạng thái `in-progress/future/past` của FE: đó là trạng thái suy
 * diễn theo từng học viên (xem §7.2), không phải thuộc tính của khoá học.
 */
@Entity('courses')
@Index('uq_courses_code', ['code'], { unique: true })
@Index('uq_courses_slug', ['slug'], { unique: true })
@Index('idx_courses_category_status', ['categoryId', 'status'])
@Index('idx_courses_owner', ['ownerId'])
@Check(
	'chk_courses_status',
	`"status" IN ('draft', 'published', 'hidden', 'archived')`,
)
@Check(
	'chk_courses_visibility',
	`"visibility" IN ('public', 'unlisted', 'private')`,
)
export class Course extends BaseEntityCustom {
	/** Mã khoá học hiển thị cho người dùng (khớp `code` của FE) — phải duy nhất. */
	@Column({ type: 'varchar', name: 'code', length: 50 })
	code: string;

	/**
	 * Placeholder index cho tìm kiếm full-text: index thật là expression + GIN nên
	 * TypeORM không biểu diễn được — phải tạo thủ công.
	 *
	 * DDL thật:
	 * CREATE INDEX "idx_courses_search_tsv" ON "courses" USING GIN
	 *   (to_tsvector('simple', "title" || ' ' || COALESCE("summary", '')));
	 */
	@Index('idx_courses_search_tsv', { synchronize: false })
	@Column({ type: 'varchar', name: 'title', length: 255 })
	title: string;

	@Column({ type: 'varchar', name: 'slug', length: 280 })
	slug: string;

	/** Mô tả ngắn cho card catalog; tách khỏi `description` để không tải text lớn. */
	@Column({ type: 'varchar', name: 'summary', length: 500, nullable: true })
	summary: string | null;

	/** Đề cương/điều kiện tiên quyết (proposal §3.1 "syllabus, prerequisites"). */
	@Column({ type: 'text', name: 'description', nullable: true })
	description: string | null;

	@Column({ type: 'uuid', name: 'category_id', nullable: true })
	categoryId: string | null;

	/** Xoá danh mục không được xoá khoá học → `SET NULL` (§4.2). */
	@ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
	@JoinColumn({ name: 'category_id' })
	category: Category | null;

	@Column({ type: 'uuid', name: 'owner_id' })
	ownerId: string;

	/**
	 * Giảng viên phụ trách chính. `RESTRICT` theo §4.2: không cho xoá người dùng khi
	 * vẫn còn khoá học họ phụ trách — nếu `CASCADE`/`SET NULL` thì khoá học sẽ mồ côi
	 * chủ sở hữu, phá vỡ RBAC tầng truy vấn.
	 */
	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'owner_id' })
	owner: User;

	@Column({ type: 'varchar', name: 'cover_url', length: 512, nullable: true })
	coverUrl: string | null;

	@Column({ type: 'varchar', name: 'level', length: 20, nullable: true })
	level: CourseLevel | null;

	/** Không ràng buộc tiếng Anh: nội dung có thể là bất kỳ môn nào. */
	@Column({ type: 'varchar', name: 'language', length: 10, default: 'vi' })
	language: string;

	/** Dạng hiển thị, ví dụ '1/2026-2027' (khớp `semester` của FE). */
	@Column({ type: 'varchar', name: 'semester', length: 20, nullable: true })
	semester: string | null;

	/**
	 * Placeholder index cho danh sách catalog: index thật có `DESC` + partial nên
	 * TypeORM không sinh đúng DDL — phải tạo thủ công.
	 *
	 * DDL thật:
	 * CREATE INDEX "idx_courses_status_published" ON "courses" ("status", "published_at" DESC)
	 *   WHERE "deleted_at" IS NULL;
	 */
	@Index('idx_courses_status_published', { synchronize: false })
	@Column({ type: 'varchar', name: 'status', length: 20, default: 'draft' })
	status: CourseStatus;

	@Column({
		type: 'varchar',
		name: 'visibility',
		length: 20,
		default: 'public',
	})
	visibility: CourseVisibility;

	/**
	 * `numeric` được driver `pg` trả về **string**; nếu không có transformer thì mọi
	 * phép tính giờ tín chỉ sẽ là nối chuỗi (§8.7).
	 */
	@Column({
		type: 'numeric',
		name: 'estimated_hours',
		precision: 5,
		scale: 1,
		nullable: true,
		transformer: {
			to: (value: number | null) => value,
			from: (value: string | null) => (value === null ? null : Number(value)),
		},
	})
	estimatedHours: number | null;

	/** Cho phép tự ghi danh hay không (khoá nội bộ có thể chỉ ghi danh thủ công). */
	@Column({ type: 'boolean', name: 'enrollment_open', default: true })
	enrollmentOpen: boolean;

	/** NULL = không giới hạn sĩ số. */
	@Column({ type: 'integer', name: 'max_students', nullable: true })
	maxStudents: number | null;

	@Column({ type: 'timestamptz', name: 'published_at', nullable: true })
	publishedAt: Date | null;

	@Column({ type: 'timestamptz', name: 'archived_at', nullable: true })
	archivedAt: Date | null;

	/** Cột FK thô — quan hệ khai báo ở `createdByUser` ngay dưới. */
	@Column({ type: 'uuid', name: 'created_by', nullable: true })
	createdBy: string | null;

	/**
	 * Admin tạo hộ giảng viên → dữ liệu tham chiếu, xoá người dùng thì `SET NULL`
	 * để khoá học vẫn còn (§4.2). Khai báo quan hệ (không chỉ cột trần như mẫu §8.3)
	 * để `migration:generate` không sinh lệnh DROP FK mà §3.2.2 yêu cầu.
	 */
	@ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
	@JoinColumn({ name: 'created_by' })
	createdByUser: User | null;

	/** Soft delete: catalog và index partial đều lọc theo cột này. */
	@Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
	deletedAt: Date | null;
}
