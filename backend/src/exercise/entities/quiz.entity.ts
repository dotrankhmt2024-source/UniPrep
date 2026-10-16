import { Check, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { QuizType } from '../../common/types';
import { Course } from '../../course/entities/course.entity';
import { CourseSection } from '../../course/entities/course-section.entity';
import { Lesson } from '../../lesson/entities/lesson.entity';
import { User } from '../../user/entities/user.entity';

/**
 * `pg` trả cột `numeric` về dạng string → ép về number để so sánh điểm đúng
 * (database-design §8.7).
 */
const numericTransformer = {
	to: (value: number | null) => value,
	from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * Bài kiểm tra / đề luyện thi có hẹn giờ, gắn vào một bài học (bài tập cuối bài)
 * hoặc vào khoá học (đề giữa kỳ/cuối kỳ).
 * Xem `docs/02-specs/database-design.md` §3.3.3.
 */
@Entity('quizzes')
@Check(
	'chk_quizzes_quiz_type',
	`"quiz_type" IN ('practice', 'graded', 'placement')`,
)
@Check(
	'chk_quizzes_time_limit_seconds',
	'"time_limit_seconds" IS NULL OR "time_limit_seconds" > 0',
)
@Check(
	'chk_quizzes_show_answers_after',
	`"show_answers_after" IN ('never', 'after_submit', 'after_due')`,
)
export class Quiz extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'course_id' })
	courseId: string;

	// CASCADE: quiz là nội dung của khoá học, không tồn tại độc lập (§4.2).
	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course;

	@Column({ type: 'uuid', name: 'lesson_id', nullable: true })
	lessonId: string | null;

	// SET NULL: xoá bài học chỉ làm quiz mất ngữ cảnh gắn kết, không được xoá quiz
	// (điểm và bài nộp của học viên vẫn phải giữ được — §4.2).
	@ManyToOne(() => Lesson, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'lesson_id' })
	lesson: Lesson | null;

	@Column({ type: 'uuid', name: 'section_id', nullable: true })
	sectionId: string | null;

	// SET NULL: cùng lý do như `lesson_id`.
	@ManyToOne(() => CourseSection, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'section_id' })
	section: CourseSection | null;

	@Column({ type: 'varchar', name: 'title', length: 255 })
	title: string;

	@Column({ type: 'text', name: 'description', nullable: true })
	description: string | null;

	// Union `QuizType` hiện chỉ có 'practice' | 'graded', trong khi CHECK của tài
	// liệu (§3.3.3) còn có 'placement'. Giữ CHECK đúng theo tài liệu; khi bổ sung
	// loại đề xếp lớp thì cập nhật union trong `common/types/assessment.type.ts`
	// (nguồn chân lý của tầng TypeScript) rồi dùng giá trị đó ở service.
	@Column({
		type: 'varchar',
		name: 'quiz_type',
		length: 20,
		default: 'practice',
	})
	quizType: QuizType;

	// NULL = không hẹn giờ.
	@Column({ type: 'integer', name: 'time_limit_seconds', nullable: true })
	timeLimitSeconds: number | null;

	// NULL = không giới hạn số lần làm bài.
	@Column({ type: 'integer', name: 'max_attempts', nullable: true })
	maxAttempts: number | null;

	@Column({
		type: 'numeric',
		name: 'pass_score',
		precision: 5,
		scale: 2,
		nullable: true,
		transformer: numericTransformer,
	})
	passScore: number | null;

	@Column({ type: 'boolean', name: 'shuffle_questions', default: false })
	shuffleQuestions: boolean;

	// Chưa có union dùng chung cho cột này nên giữ `string`; tập giá trị hợp lệ
	// được chặn bằng CHECK `chk_quizzes_show_answers_after` ở trên.
	@Column({
		type: 'varchar',
		name: 'show_answers_after',
		length: 20,
		default: 'after_submit',
	})
	showAnswersAfter: string;

	@Column({ type: 'timestamptz', name: 'available_from', nullable: true })
	availableFrom: Date | null;

	@Column({ type: 'timestamptz', name: 'due_at', nullable: true })
	dueAt: Date | null;

	@Column({ type: 'boolean', name: 'is_published', default: false })
	isPublished: boolean;

	@Column({ type: 'uuid', name: 'created_by', nullable: true })
	createdBy: string | null;

	// SET NULL: dữ liệu tham chiếu — giữ lại quiz kể cả khi người tạo bị xoá (§4.2).
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'created_by' })
	creator: User | null;

	// Soft delete: quiz đã có bài nộp không được xoá cứng để không phá vỡ lịch sử
	// điểm của học viên (§11 câu hỏi mở 3).
	@Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
	deletedAt: Date | null;
}
