import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { AIJobStatus, AIJobType } from '../../common/types';
import { Course } from '../../course/entities/course.entity';
import { User } from '../../user/entities/user.entity';
import { ModelVersion } from '../../analytics/entities/model-version.entity';

/**
 * Bảng `ai_jobs` (§3.4.5) — trạng thái các job AI/heavy task mà NestJS đẩy sang
 * BullMQ và FastAPI xử lý, để API không phải chờ và để admin xem log job.
 *
 * Vì sao `id` là UUID do mình sinh: chính `id` này được dùng làm `jobId` khi đẩy
 * vào BullMQ ⇒ tra cứu DB ↔ Redis không cần bảng ánh xạ phụ.
 *
 * Vì sao KHÔNG lưu kết quả dự đoán ở đây: `result` chỉ là bản tóm tắt; dự đoán đầy
 * đủ nằm ở `risk_predictions` (một nguồn chân lý, tránh hai bản dữ liệu lệch nhau).
 */
@Entity('ai_jobs')
@Index('idx_ai_jobs_status_queued', ['status', 'queuedAt'])
@Index('idx_ai_jobs_type_status', ['jobType', 'status'])
@Check(
	'chk_ai_jobs_status',
	"\"status\" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')",
)
export class AIJob extends BaseEntityCustom {
	@Column({ type: 'varchar', name: 'job_type', length: 40 })
	jobType: AIJobType;

	@Column({ type: 'varchar', name: 'status', length: 20, default: 'queued' })
	status: AIJobStatus;

	/** ID trong Redis; NULL khi job chạy đồng bộ (không qua BullMQ). */
	@Column({ type: 'varchar', name: 'bull_job_id', length: 100, nullable: true })
	bullJobId: string | null;

	/** Tên queue BullMQ — tách cột để sau này có nhiều queue theo loại job. */
	@Column({
		type: 'varchar',
		name: 'queue_name',
		length: 50,
		default: 'ai-jobs',
	})
	queueName: string;

	/** Dữ liệu tham chiếu ⇒ SET NULL: log job phải còn kể cả khi người yêu cầu bị xoá (§4.2). */
	@Column({ type: 'uuid', name: 'requested_by', nullable: true })
	requestedBy: string | null;

	/** NULL = job do scheduler tạo, không có người yêu cầu. */
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'requested_by' })
	requester: User | null;

	/**
	 * DDL thủ công (index có `DESC` — TypeORM không biểu diễn được):
	 * CREATE INDEX "idx_ai_jobs_course_time" ON "ai_jobs" ("course_id", "created_at" DESC);
	 */
	@Index('idx_ai_jobs_course_time', { synchronize: false })
	@Column({ type: 'uuid', name: 'course_id', nullable: true })
	courseId: string | null;

	@ManyToOne(() => Course, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'course_id' })
	course: Course | null;

	/** Học viên mà job tác động (job dự đoán theo lô có thể không có học viên đơn lẻ). */
	@Column({ type: 'uuid', name: 'target_user_id', nullable: true })
	targetUserId: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'target_user_id' })
	targetUser: User | null;

	@Column({ type: 'uuid', name: 'model_version_id', nullable: true })
	modelVersionId: string | null;

	/** SET NULL (khác `risk_predictions.model_version_id` là RESTRICT): job chỉ là log thực thi. */
	@ManyToOne(() => ModelVersion, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'model_version_id' })
	modelVersion: ModelVersion | null;

	// Object literal, không dùng hàm — xem giải thích ở `notification.entity.ts`.
	@Column({ type: 'jsonb', name: 'payload', default: {} })
	payload: Record<string, unknown>;

	/** Kết quả tóm tắt để admin đọc nhanh — không phải nơi lưu dự đoán đầy đủ. */
	@Column({ type: 'jsonb', name: 'result', nullable: true })
	result: Record<string, unknown> | null;

	@Column({ type: 'text', name: 'error_message', nullable: true })
	errorMessage: string | null;

	/** Số lần đã thử; `smallint` là đủ vì số lần thử luôn nhỏ. */
	@Column({ type: 'smallint', name: 'attempts', default: 0 })
	attempts: number;

	@Column({ type: 'smallint', name: 'max_attempts', default: 3 })
	maxAttempts: number;

	/** Số lớn hơn = ưu tiên cao hơn (quy ước BullMQ). */
	@Column({ type: 'smallint', name: 'priority', default: 0 })
	priority: number;

	/** Thời điểm mong muốn chạy; NULL = chạy ngay khi rảnh. */
	@Column({ type: 'timestamptz', name: 'scheduled_at', nullable: true })
	scheduledAt: Date | null;

	@Column({ type: 'timestamptz', name: 'queued_at', default: () => 'now()' })
	queuedAt: Date;

	@Column({ type: 'timestamptz', name: 'started_at', nullable: true })
	startedAt: Date | null;

	@Column({ type: 'timestamptz', name: 'finished_at', nullable: true })
	finishedAt: Date | null;

	/** Lưu sẵn thời lượng để dashboard không phải tự trừ hai mốc thời gian. */
	@Column({ type: 'integer', name: 'duration_ms', nullable: true })
	durationMs: number | null;
}
