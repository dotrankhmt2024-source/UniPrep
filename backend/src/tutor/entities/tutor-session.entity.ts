import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { Course } from '../../course/entities/course.entity';
import { User } from '../../user/entities/user.entity';

/**
 * Bảng `tutor_sessions` — một cuộc trò chuyện giữa một người dùng và trợ giảng AI của một khoá học.
 *
 * Trợ giảng chỉ trả lời dựa trên học liệu của **đúng một** khoá học, nên `course_id` gắn vào phiên
 * chứ không vào từng tin nhắn: đổi khoá học là mở cuộc trò chuyện mới.
 */
@Entity('tutor_sessions')
@Index('idx_tutor_sessions_user_updated', ['userId', 'updatedAt'])
export class TutorSession extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'user_id' })
	userId: string;

	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User;

	@Column({ type: 'uuid', name: 'course_id' })
	courseId: string;

	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course;

	@Column({ type: 'varchar', name: 'title', length: 120 })
	title: string;

	/** Model đã dùng khi tạo phiên, để trajectory cũ vẫn đọc đúng ngữ cảnh. */
	@Column({ type: 'varchar', name: 'model', length: 80 })
	model: string;

	/**
	 * Bài học người dùng đang xem ở lượt gần nhất. Chỉ khi giá trị này đổi mới ghi thêm một bước
	 * `context` (model vẫn nhớ bài cũ trong lịch sử, gửi lại mỗi lượt là phí token).
	 */
	@Column({ type: 'uuid', name: 'context_lesson_id', nullable: true })
	contextLessonId: string | null;
}
