import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { LessonProgressStatus } from '../../common/types';
import { Course } from '../../course/entities/course.entity';
import { Enrollment } from '../../course/entities/enrollment.entity';
import { Lesson } from '../../lesson/entities/lesson.entity';
import { User } from '../../user/entities/user.entity';

/**
 * Trạng thái học từng bài của từng học viên — nguồn của "tỷ lệ hoàn thành" và
 * "hoàn thành đúng hạn" (`completed_at` so với `lessons.due_at`).
 * Xem `docs/02-specs/database-design.md` §3.3.2.
 */
@Entity('lesson_progress')
@Index('uq_lesson_progress_enrollment_lesson', ['enrollmentId', 'lessonId'], {
	unique: true,
})
@Index('idx_lesson_progress_user_status', ['userId', 'status'])
@Index('idx_lesson_progress_course_completed', ['courseId', 'completedAt'], {
	where: `"status" = 'completed'`,
})
@Check(
	'chk_lesson_progress_status',
	`"status" IN ('not_started', 'in_progress', 'completed')`,
)
@Check('chk_lesson_progress_time_spent_seconds', '"time_spent_seconds" >= 0')
export class LessonProgress extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'enrollment_id' })
	enrollmentId: string;

	// CASCADE: tiến độ thuộc về ghi danh; ghi danh mất thì tiến độ vô nghĩa (§4.2).
	@ManyToOne(() => Enrollment, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'enrollment_id' })
	enrollment: Enrollment;

	@Column({ type: 'uuid', name: 'user_id' })
	userId: string;

	// CASCADE: dữ liệu học tập là dữ liệu cá nhân, xoá cứng người dùng là xoá sạch.
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User;

	// Denormalize có chủ đích: analytics lọc tiến độ theo khoá mà không phải join
	// qua `enrollments`/`lessons` (§3.3.2).
	@Column({ type: 'uuid', name: 'course_id' })
	courseId: string;

	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course;

	@Column({ type: 'uuid', name: 'lesson_id' })
	lessonId: string;

	@ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'lesson_id' })
	lesson: Lesson;

	@Column({
		type: 'varchar',
		name: 'status',
		length: 20,
		default: 'not_started',
	})
	status: LessonProgressStatus;

	@Column({ type: 'timestamptz', name: 'first_viewed_at', nullable: true })
	firstViewedAt: Date | null;

	@Column({ type: 'timestamptz', name: 'last_viewed_at', nullable: true })
	lastViewedAt: Date | null;

	// So với `lessons.due_at` để suy ra hoàn thành đúng hạn hay muộn.
	@Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
	completedAt: Date | null;

	@Column({
		type: 'integer',
		name: 'time_spent_seconds',
		default: 0,
	})
	timeSpentSeconds: number;

	// Phục vụ "resume from where they left off" (proposal §1.2).
	@Column({ type: 'integer', name: 'last_position_seconds', nullable: true })
	lastPositionSeconds: number | null;

	@Column({ type: 'integer', name: 'view_count', default: 0 })
	viewCount: number;
}
