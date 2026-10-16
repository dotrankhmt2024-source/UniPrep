import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { Course } from '../../course/entities/course.entity';
import { CourseSection } from '../../course/entities/course-section.entity';
import { User } from '../../user/entities/user.entity';

/**
 * Bài học — đơn vị tiến độ nhỏ nhất mà học viên hoàn thành
 * (`docs/02-specs/database-design.md` §3.2.6), viết theo mẫu §8.4.
 *
 * Vì sao có cả `course_id` (đã suy ra được qua `section_id`): **cố ý denormalize**
 * để truy vấn analytics không phải join `course_sections` — đây là bảng bị quét
 * nhiều nhất trong các job tổng hợp tiến độ.
 */
@Entity('lessons')
@Index('uq_lessons_course_slug', ['courseId', 'slug'], { unique: true })
@Check(
	'chk_lessons_content_format',
	`"content_format" IN ('markdown', 'html', 'tiptap_json')`,
)
export class Lesson extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'course_id' })
	courseId: string;

	/** Nội dung không tồn tại độc lập với khoá học → `CASCADE` (§4.2). */
	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course;

	@Column({ type: 'uuid', name: 'section_id' })
	sectionId: string;

	@ManyToOne(() => CourseSection, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'section_id' })
	section: CourseSection;

	@Column({ type: 'varchar', name: 'title', length: 255 })
	title: string;

	/** Slug chỉ cần duy nhất trong một khoá (URL dạng /courses/:slug/lessons/:slug). */
	@Column({ type: 'varchar', name: 'slug', length: 280 })
	slug: string;

	@Column({ type: 'varchar', name: 'summary', length: 500, nullable: true })
	summary: string | null;

	/** Nội dung text (markdown) của bài. */
	@Column({ type: 'text', name: 'content', nullable: true })
	content: string | null;

	/**
	 * Repo dùng TipTap 3 nên ngoài `markdown` còn phải nhận `html` và JSON của
	 * TipTap. Union type `ContentFormat` chưa có trong `common/types` — xem báo cáo.
	 */
	@Column({
		type: 'varchar',
		name: 'content_format',
		length: 20,
		default: 'markdown',
	})
	contentFormat: 'markdown' | 'html' | 'tiptap_json';

	/**
	 * Placeholder index cho lộ trình học.
	 *
	 * Vì sao placeholder: index thật là partial (`WHERE "deleted_at" IS NULL`) nên
	 * TypeORM không sinh DDL tương ứng khi đồng bộ schema — phải tạo thủ công.
	 *
	 * DDL thật:
	 * CREATE UNIQUE INDEX "uq_lessons_course_order" ON "lessons" ("course_id", "order_index")
	 *   WHERE "deleted_at" IS NULL;
	 */
	@Index('uq_lessons_course_order', { synchronize: false })
	@Column({ type: 'integer', name: 'order_index' })
	orderIndex: number;

	@Column({ type: 'integer', name: 'estimated_minutes', nullable: true })
	estimatedMinutes: number | null;

	/** Mở bài theo lịch (ví dụ mở dần theo tuần). */
	@Column({ type: 'timestamptz', name: 'available_from', nullable: true })
	availableFrom: Date | null;

	/**
	 * Hạn hoàn thành; NULL = không có hạn → feature "hoàn thành đúng hạn" bỏ qua bài
	 * này thay vì coi là trễ.
	 */
	@Column({ type: 'timestamptz', name: 'due_at', nullable: true })
	dueAt: Date | null;

	/**
	 * Placeholder index cho danh sách bài đã publish theo lộ trình (§4.4).
	 *
	 * DDL thật:
	 * CREATE INDEX "idx_lessons_course_order_published" ON "lessons" ("course_id", "order_index")
	 *   WHERE "is_published" AND "deleted_at" IS NULL;
	 */
	@Index('idx_lessons_course_order_published', { synchronize: false })
	@Column({ type: 'boolean', name: 'is_published', default: false })
	isPublished: boolean;

	@Column({ type: 'timestamptz', name: 'published_at', nullable: true })
	publishedAt: Date | null;

	/** Cột FK thô — quan hệ khai báo ở `createdByUser` ngay dưới. */
	@Column({ type: 'uuid', name: 'created_by', nullable: true })
	createdBy: string | null;

	/**
	 * Dữ liệu tham chiếu: xoá người tạo thì bài học vẫn còn → `SET NULL` (§4.2).
	 * Khai báo quan hệ (không chỉ cột trần như mẫu §8.4) để `migration:generate`
	 * không sinh lệnh DROP FK mà §3.2.6 yêu cầu.
	 */
	@ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
	@JoinColumn({ name: 'created_by' })
	createdByUser: User | null;

	/** Soft delete: bài đã xoá mềm không chiếm chỗ trong lộ trình (index partial). */
	@Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
	deletedAt: Date | null;
}
