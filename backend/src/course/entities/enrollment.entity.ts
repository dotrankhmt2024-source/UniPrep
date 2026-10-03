import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { EnrollmentStatus } from '../../common/types';
import { Course } from '../../course/entities/course.entity';
import { User } from '../../user/entities/user.entity';

/**
 * `pg` trả cột `numeric` về dạng string → ép về number để các phép tính tiến độ
 * và điểm số không bị nối chuỗi (database-design §8.7).
 */
const numericTransformer = {
	to: (value: number | null) => value,
	from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * Ghi danh của học viên vào một khoá học.
 *
 * Đây là phạm vi (scope) để gom mọi dữ liệu hành vi của một học viên trong một
 * khoá; dashboard và model dự đoán đều lặp qua bảng này.
 * Xem `docs/02-specs/database-design.md` §3.3.1.
 */
@Entity('enrollments')
@Index('uq_enrollments_user_course', ['userId', 'courseId'], { unique: true })
@Index('idx_enrollments_course_status', ['courseId', 'status'])
@Index('idx_enrollments_cohort', ['cohortId'], {
	where: '"cohort_id" IS NOT NULL',
})
@Check(
	'chk_enrollments_status',
	`"status" IN ('active', 'completed', 'dropped', 'expired')`,
)
@Check('chk_enrollments_source', `"source" IN ('self', 'invited', 'admin')`)
@Check(
	'chk_enrollments_progress_percent',
	'"progress_percent" BETWEEN 0 AND 100',
)
export class Enrollment extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'user_id' })
	userId: string;

	// CASCADE: xoá cứng một người dùng phải xoá sạch dữ liệu cá nhân của họ
	// (yêu cầu quyền riêng tư — database-design §4.2).
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User;

	@Column({ type: 'uuid', name: 'course_id' })
	courseId: string;

	// CASCADE: ghi danh không tồn tại độc lập với khoá học (§4.2).
	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course;

	// TODO(E3, chuyển từ E2-T3 ngày 2026-10-03): thêm FK tới `cohorts` khi bảng được tạo.
	// `cohorts` có FK `course_id → courses` nên chỉ làm được sau E3-T1; vì vậy hiện chỉ khai báo cột
	// uuid nullable, KHÔNG tạo relation (tránh import entity chưa tồn tại).
	@Column({ type: 'uuid', name: 'cohort_id', nullable: true })
	cohortId: string | null;

	@Column({ type: 'varchar', name: 'status', length: 20, default: 'active' })
	status: EnrollmentStatus;

	// `enrollments.source` chưa có union type dùng chung trong `common/types`
	// (không tự định nghĩa union mới) nên giữ `string`; tập giá trị hợp lệ được
	// chặn bằng CHECK `chk_enrollments_source` ở trên.
	@Column({ type: 'varchar', name: 'source', length: 20, default: 'self' })
	source: string;

	@Column({ type: 'timestamptz', name: 'enrolled_at', default: () => 'now()' })
	enrolledAt: Date;

	@Column({ type: 'timestamptz', name: 'started_at', nullable: true })
	startedAt: Date | null;

	// Cache của feature recency: `LearningActivityModule` cập nhật mỗi khi có
	// hoạt động, nhờ đó dashboard không phải quét `learning_events`.
	//
	// Index thật phải tạo thủ công (có `DESC` + partial nên TypeORM không sinh
	// được qua `@Index`); placeholder dưới đây chỉ để tài liệu hoá tên index:
	//   CREATE INDEX idx_enrollments_user_active ON enrollments (user_id, last_activity_at DESC) WHERE status = 'active';
	@Index('idx_enrollments_user_active', { synchronize: false })
	@Column({ type: 'timestamptz', name: 'last_activity_at', nullable: true })
	lastActivityAt: Date | null;

	@Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
	completedAt: Date | null;

	@Column({ type: 'timestamptz', name: 'dropped_at', nullable: true })
	droppedAt: Date | null;

	// Cột cache (database-design §11 câu hỏi mở 10): đọc nhanh hơn tính lại từ
	// `lesson_progress`, đổi lại phải cập nhật mỗi khi có bài học hoàn thành.
	@Column({
		type: 'numeric',
		name: 'progress_percent',
		precision: 5,
		scale: 2,
		default: 0,
		transformer: numericTransformer,
	})
	progressPercent: number;

	@Column({
		type: 'numeric',
		name: 'final_score',
		precision: 5,
		scale: 2,
		nullable: true,
		transformer: numericTransformer,
	})
	finalScore: number | null;
}
