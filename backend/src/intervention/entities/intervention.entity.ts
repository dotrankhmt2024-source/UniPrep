import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { RiskPrediction } from '../../analytics/entities/risk-prediction.entity';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import {
	InterventionStatus,
	InterventionType,
	NotificationChannel,
} from '../../common/types';
import { Course } from '../../course/entities/course.entity';
import { Enrollment } from '../../course/entities/enrollment.entity';
import { User } from '../../user/entities/user.entity';

/**
 * Hành động can thiệp của giảng viên/hệ thống với học viên bị gắn cờ — bảng
 * `interventions` (database-design.md §3.5.1).
 *
 * Đây là mắt nối giữa dự đoán rủi ro (`risk_predictions`) và hành động thực tế,
 * nên `course_id`/`user_id` là hai trục truy vấn chính (dashboard theo khoá và
 * lịch sử can thiệp của một học viên).
 */
@Entity('interventions')
@Check(
	'chk_interventions_intervention_type',
	`"intervention_type" IN ('in_app_message', 'email_reminder', 'recommended_lesson', 'mentor_assignment', 'manual_note')`,
)
@Check(
	'chk_interventions_channel',
	`"channel" IN ('in_app', 'email', 'websocket')`,
)
@Check(
	'chk_interventions_status',
	`"status" IN ('draft', 'sent', 'acknowledged', 'completed', 'cancelled')`,
)
@Check(
	'chk_interventions_outcome',
	`"outcome" IS NULL OR "outcome" IN ('improved', 'no_change', 'worsened', 'unknown')`,
)
@Index('idx_interventions_course_status', ['courseId', 'status'])
export class Intervention extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'course_id' })
	courseId: string;

	/** Nội dung không tồn tại độc lập với khoá học ⇒ xoá khoá học là xoá can thiệp (§4.2). */
	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course;

	/**
	 * DDL thủ công (index có `DESC` — TypeORM không biểu diễn được thứ tự sắp xếp):
	 * `CREATE INDEX "idx_interventions_user_time" ON "interventions" ("user_id", "created_at" DESC);`
	 */
	@Index('idx_interventions_user_time', { synchronize: false })
	@Column({ type: 'uuid', name: 'user_id' })
	userId: string;

	/** Dữ liệu thuộc sở hữu người dùng ⇒ xoá cứng học viên phải xoá can thiệp của họ (§4.2). */
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User;

	/**
	 * DDL thủ công (index có `DESC`):
	 * `CREATE INDEX "idx_interventions_instructor_time" ON "interventions" ("instructor_id", "created_at" DESC);`
	 */
	@Index('idx_interventions_instructor_time', { synchronize: false })
	@Column({ type: 'uuid', name: 'instructor_id', nullable: true })
	instructorId: string | null;

	/**
	 * Người gửi; NULL = hệ thống tự động gửi. Là dữ liệu tham chiếu nên giữ lại
	 * bản ghi can thiệp kể cả khi tài khoản giảng viên bị xoá (§4.2).
	 */
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'instructor_id' })
	instructor: User | null;

	@Column({ type: 'uuid', name: 'risk_prediction_id', nullable: true })
	riskPredictionId: string | null;

	/** Căn cứ của can thiệp; xoá dự đoán không được làm mất lịch sử can thiệp (§4.2). */
	@ManyToOne(() => RiskPrediction, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'risk_prediction_id' })
	riskPrediction: RiskPrediction | null;

	@Column({ type: 'uuid', name: 'enrollment_id', nullable: true })
	enrollmentId: string | null;

	/** Ghi danh là dữ liệu tham chiếu ở đây — can thiệp vẫn còn giá trị lịch sử khi ghi danh bị xoá. */
	@ManyToOne(() => Enrollment, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'enrollment_id' })
	enrollment: Enrollment | null;

	@Column({ type: 'varchar', name: 'intervention_type', length: 30 })
	interventionType: InterventionType;

	/**
	 * Dùng chung `NotificationChannel` vì §3.5.1 và §3.5.2 quy định cùng tập giá trị
	 * (`in_app`/`email`/`websocket`); `common/types` chưa có union `InterventionChannel`
	 * riêng (xem báo cáo cuối).
	 */
	@Column({ type: 'varchar', name: 'channel', length: 20, default: 'in_app' })
	channel: NotificationChannel;

	@Column({ type: 'varchar', name: 'title', length: 255 })
	title: string;

	/** Nội dung tiếng Việt gửi cho học viên (§1.1 #7). */
	@Column({ type: 'text', name: 'content' })
	content: string;

	/**
	 * Danh sách bài nên ôn. Postgres không hỗ trợ FK cho phần tử mảng nên toàn vẹn
	 * do tầng service/DTO kiểm tra trước khi ghi (§4.5 #3).
	 */
	@Column({
		type: 'uuid',
		name: 'recommended_lesson_ids',
		array: true,
		nullable: true,
	})
	recommendedLessonIds: string[] | null;

	@Column({ type: 'varchar', name: 'status', length: 20, default: 'draft' })
	status: InterventionStatus;

	@Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
	sentAt: Date | null;

	@Column({ type: 'timestamptz', name: 'acknowledged_at', nullable: true })
	acknowledgedAt: Date | null;

	@Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
	completedAt: Date | null;

	/**
	 * TODO(union): tài liệu §3.5.1 chỉ định nghĩa `CHECK`, chưa có union cho outcome
	 * (ví dụ `InterventionOutcome`) trong `common/types` — tạm dùng `string | null`,
	 * xem báo cáo cuối.
	 */
	@Column({ type: 'varchar', name: 'outcome', length: 20, nullable: true })
	outcome: string | null;

	/** Giảng viên ghi chú kết quả can thiệp. */
	@Column({ type: 'text', name: 'outcome_note', nullable: true })
	outcomeNote: string | null;

	@Column({ type: 'uuid', name: 'created_by', nullable: true })
	createdById: string | null;

	/** Dữ liệu tham chiếu ⇒ SET NULL để không mất vết can thiệp (§4.2). */
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'created_by' })
	createdBy: User | null;
}
