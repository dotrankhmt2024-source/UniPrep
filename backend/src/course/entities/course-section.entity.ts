import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { Course } from './course.entity';

/**
 * Chương/chủ đề trong khoá học — cấp trung gian giữa `courses` và `lessons`
 * (`docs/02-specs/database-design.md` §3.2.5).
 *
 * Vì sao `UNIQUE (course_id, order_index)`: thứ tự chương là lộ trình hiển thị,
 * hai chương cùng số thứ tự trong một khoá sẽ cho ra thứ tự không xác định.
 */
@Entity('course_sections')
@Index('uq_course_sections_course_order', ['courseId', 'orderIndex'], {
	unique: true,
})
export class CourseSection extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'course_id' })
	courseId: string;

	/** Nội dung không tồn tại độc lập với khoá học → `CASCADE` (§4.2). */
	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course;

	@Column({ type: 'varchar', name: 'title', length: 255 })
	title: string;

	@Column({ type: 'text', name: 'description', nullable: true })
	description: string | null;

	/** Không có default: mỗi chương phải được đặt thứ tự tường minh. */
	@Column({ type: 'integer', name: 'order_index' })
	orderIndex: number;

	/**
	 * Chương có thể đã publish trong khi bài bên trong vẫn ẩn (`lessons.is_published`),
	 * nên hai cờ này độc lập với nhau.
	 */
	@Column({ type: 'boolean', name: 'is_published', default: false })
	isPublished: boolean;

	@Column({ type: 'timestamptz', name: 'published_at', nullable: true })
	publishedAt: Date | null;
}
