import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { Course } from '../../course/entities/course.entity';
import { Lesson } from '../../lesson/entities/lesson.entity';
import { User } from '../../user/entities/user.entity';

/**
 * Chủ đề thảo luận trong khoá học/bài học — hoạt động thảo luận là một tín hiệu
 * hành vi tích cực cho model dự đoán.
 * Xem `docs/02-specs/database-design.md` §3.3.8.
 */
@Entity('discussion_threads')
export class DiscussionThread extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'course_id' })
	courseId: string;

	// CASCADE: chủ đề là nội dung của khoá học, không tồn tại độc lập (§4.2).
	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course;

	@Column({ type: 'uuid', name: 'lesson_id', nullable: true })
	lessonId: string | null;

	// SET NULL: thảo luận cấp khoá vẫn phải giữ được khi bài học bị xoá (§4.2).
	@ManyToOne(() => Lesson, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'lesson_id' })
	lesson: Lesson | null;

	@Column({ type: 'uuid', name: 'author_id' })
	authorId: string;

	// CASCADE: nội dung do người dùng tạo là dữ liệu cá nhân của họ (§4.2).
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'author_id' })
	author: User;

	@Column({ type: 'varchar', name: 'title', length: 255 })
	title: string;

	@Column({ type: 'text', name: 'body' })
	body: string;

	@Column({ type: 'boolean', name: 'is_pinned', default: false })
	isPinned: boolean;

	// Khoá bình luận thêm nhưng vẫn đọc được nội dung cũ.
	@Column({ type: 'boolean', name: 'is_locked', default: false })
	isLocked: boolean;

	// Kết quả kiểm duyệt (`content_reports`) — ẩn nội dung nhưng giữ bản ghi để
	// admin xem lại và để không phá vỡ ngữ cảnh của các bài viết khác.
	@Column({ type: 'boolean', name: 'is_hidden', default: false })
	isHidden: boolean;

	@Column({ type: 'uuid', name: 'hidden_by', nullable: true })
	hiddenBy: string | null;

	// SET NULL: dữ liệu tham chiếu — quyết định kiểm duyệt vẫn còn giá trị sau khi
	// người kiểm duyệt bị xoá (§4.2).
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'hidden_by' })
	moderator: User | null;

	@Column({
		type: 'varchar',
		name: 'hidden_reason',
		length: 255,
		nullable: true,
	})
	hiddenReason: string | null;

	// Cache số bài viết để hiển thị danh sách chủ đề mà không phải COUNT mỗi lần.
	@Column({ type: 'integer', name: 'post_count', default: 0 })
	postCount: number;

	@Column({ type: 'timestamptz', name: 'last_post_at', nullable: true })
	lastPostAt: Date | null;

	// Soft delete là BẮT BUỘC: xoá cứng chủ đề sẽ kéo theo các bài viết và làm mất
	// ngữ cảnh thảo luận của người khác (§3.3.8, §11 câu hỏi mở 3).
	@Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
	deletedAt: Date | null;
}
