import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { SubmissionStatus } from '../../common/types';
import { Course } from '../../course/entities/course.entity';
import { Enrollment } from '../../course/entities/enrollment.entity';
import { User } from '../../user/entities/user.entity';
import { Quiz } from './quiz.entity';

/**
 * `pg` trả cột `numeric` về dạng string → ép về number để tính điểm trung bình và
 * chuẩn hoá `score/max_score` cho model đúng (database-design §8.7).
 */
const numericTransformer = {
	to: (value: number | null) => value,
	from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * Một lần làm bài của một học viên — nguồn của feature "điểm trung bình & xu
 * hướng", "số lần làm lại (`attempt_no`)" và "`duration_seconds` bất thường".
 * Xem `docs/02-specs/database-design.md` §3.3.6.
 */
@Entity('submissions')
@Index('uq_submissions_attempt', ['quizId', 'userId', 'attemptNo'], {
	unique: true,
})
@Check('chk_submissions_attempt_no', '"attempt_no" >= 1')
@Check(
	'chk_submissions_status',
	`"status" IN ('in_progress', 'submitted', 'graded', 'expired')`,
)
@Check(
	'chk_submissions_duration_seconds',
	'"duration_seconds" IS NULL OR "duration_seconds" >= 0',
)
export class Submission extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'quiz_id' })
	quizId: string;

	// CASCADE: bài nộp thuộc quiz; xoá quiz là xoá bài nộp của nó (§4.2).
	@ManyToOne(() => Quiz, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'quiz_id' })
	quiz: Quiz;

	@Column({ type: 'uuid', name: 'user_id' })
	userId: string;

	// CASCADE: bài nộp là dữ liệu cá nhân của người dùng (§4.2).
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User;

	@Column({ type: 'uuid', name: 'enrollment_id' })
	enrollmentId: string;

	@ManyToOne(() => Enrollment, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'enrollment_id' })
	enrollment: Enrollment;

	// Denormalize có chủ đích: lọc analytics theo khoá mà không cần join (§3.3.6).
	@Column({ type: 'uuid', name: 'course_id' })
	courseId: string;

	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course;

	// Cùng `quiz_id`, `user_id` tạo UNIQUE `uq_submissions_attempt`: `attempt_no`
	// chỉ có nghĩa khi không trùng (§4.1).
	//
	// Index thật phải tạo thủ công (có `DESC` nên TypeORM không sinh được qua
	// `@Index`); placeholder dưới đây chỉ để tài liệu hoá tên index:
	//   CREATE INDEX idx_submissions_quiz_user ON submissions (quiz_id, user_id, attempt_no DESC);
	@Index('idx_submissions_quiz_user', { synchronize: false })
	@Column({ type: 'integer', name: 'attempt_no', default: 1 })
	attemptNo: number;

	@Column({
		type: 'varchar',
		name: 'status',
		length: 20,
		default: 'in_progress',
	})
	status: SubmissionStatus;

	// Điểm thô; NULL khi chưa chấm.
	@Column({
		type: 'numeric',
		name: 'score',
		precision: 6,
		scale: 2,
		nullable: true,
		transformer: numericTransformer,
	})
	score: number | null;

	// Tổng điểm tối đa tại thời điểm làm → chuẩn hoá `score/max_score` cho model.
	@Column({
		type: 'numeric',
		name: 'max_score',
		precision: 6,
		scale: 2,
		nullable: true,
		transformer: numericTransformer,
	})
	maxScore: number | null;

	@Column({ type: 'integer', name: 'correct_count', nullable: true })
	correctCount: number | null;

	@Column({ type: 'integer', name: 'total_questions', nullable: true })
	totalQuestions: number | null;

	@Column({ type: 'timestamptz', name: 'started_at', default: () => 'now()' })
	startedAt: Date;

	// Index thật phải tạo thủ công (`DESC` + partial nên TypeORM không sinh được
	// qua `@Index`); placeholder dưới đây chỉ để tài liệu hoá tên index:
	//   CREATE INDEX idx_submissions_user_time ON submissions (user_id, submitted_at DESC) WHERE status = 'graded';
	//   CREATE INDEX idx_submissions_course_time ON submissions (course_id, submitted_at DESC);
	@Index('idx_submissions_user_time', { synchronize: false })
	@Index('idx_submissions_course_time', { synchronize: false })
	@Column({ type: 'timestamptz', name: 'submitted_at', nullable: true })
	submittedAt: Date | null;

	@Column({ type: 'timestamptz', name: 'graded_at', nullable: true })
	gradedAt: Date | null;

	@Column({
		type: 'integer',
		name: 'duration_seconds',
		nullable: true,
	})
	durationSeconds: number | null;

	@Column({ type: 'uuid', name: 'graded_by', nullable: true })
	gradedBy: string | null;

	// SET NULL: dữ liệu tham chiếu — giữ bài nộp kể cả khi giảng viên chấm bị xoá (§4.2).
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'graded_by' })
	grader: User | null;

	// Phản hồi của giảng viên (proposal §3.1).
	@Column({ type: 'text', name: 'feedback', nullable: true })
	feedback: string | null;

	@Column({ type: 'timestamptz', name: 'feedback_at', nullable: true })
	feedbackAt: Date | null;

	// Nộp sau `quizzes.due_at` — phục vụ chỉ số "hoàn thành đúng hạn".
	@Column({ type: 'boolean', name: 'is_late', default: false })
	isLate: boolean;
}
