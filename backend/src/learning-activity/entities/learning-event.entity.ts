import {
	Check,
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { EventType } from '../../common/types';
import { Course } from '../../course/entities/course.entity';
import { Enrollment } from '../../course/entities/enrollment.entity';
import { Quiz } from '../../exercise/entities/quiz.entity';
import { Lesson } from '../../lesson/entities/lesson.entity';
import { User } from '../../user/entities/user.entity';

/**
 * Bảng `learning_events` (§3.4.1) — nhật ký sự kiện hành vi thô, APPEND-ONLY:
 * nguồn dữ liệu duy nhất cho mọi feature của model và mọi biểu đồ dashboard.
 *
 * Vì sao KHÔNG kế thừa `BaseEntityCustom`: bảng append-only chỉ có `created_at`,
 * không có `updated_at` (§1.1 quy ước 5), nên `id` và `createdAt` phải khai báo
 * lại tường minh — xem ví dụ mẫu §8.5.
 *
 * Vì sao các chỉ mục dùng placeholder `{ synchronize: false }`: cả 6 chỉ mục bắt
 * buộc đều chứa `occurred_at DESC` (một chỉ mục còn là partial), mà cú pháp
 * `@Index` của TypeORM không biểu diễn được `DESC` lẫn thứ tự cột của partial
 * index → khai báo thường sẽ sinh index ASC lệch tài liệu. DDL thật nằm ở comment
 * trên property liên quan (§8.7) và được liệt kê đầy đủ ở báo cáo của task.
 *
 * `event_type` CỐ Ý không có CHECK (§4.3): thêm loại sự kiện mới không phải viết
 * migration; ràng buộc giá trị do union `EventType` + DTO validation đảm bảo.
 */
@Entity('learning_events')
@Check(
	'chk_learning_events_duration_seconds',
	'"duration_seconds" IS NULL OR "duration_seconds" >= 0',
)
export class LearningEvent {
	/**
	 * PK một cột. Khi partition theo tháng (§5.3) PK bắt buộc là
	 * `(id, occurred_at)` và entity phải thêm `@PrimaryColumn` cho `occurred_at`;
	 * MVP chưa partition nên giữ PK một cột.
	 */
	@PrimaryGeneratedColumn('uuid', { name: 'id' })
	id: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt: Date;

	/**
	 * DDL thủ công (TypeORM không sinh được `DESC`/partial):
	 * CREATE INDEX "idx_learning_events_user_occurred" ON "learning_events" ("user_id", "occurred_at" DESC);
	 * CREATE INDEX "idx_learning_events_user_course_occurred" ON "learning_events" ("user_id", "course_id", "occurred_at" DESC);
	 * CREATE INDEX "idx_learning_events_logins" ON "learning_events" ("user_id", "occurred_at" DESC) WHERE "event_type" = 'login';
	 */
	@Index('idx_learning_events_user_occurred', { synchronize: false })
	@Index('idx_learning_events_user_course_occurred', { synchronize: false })
	@Index('idx_learning_events_logins', { synchronize: false })
	@Column({ type: 'uuid', name: 'user_id' })
	userId: string;

	/** CASCADE: xoá cứng người dùng phải xoá sạch dữ liệu hành vi của họ (§4.2). */
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User;

	/**
	 * DDL thủ công:
	 * CREATE INDEX "idx_learning_events_course_occurred" ON "learning_events" ("course_id", "occurred_at" DESC);
	 */
	@Index('idx_learning_events_course_occurred', { synchronize: false })
	@Column({ type: 'uuid', name: 'course_id', nullable: true })
	courseId: string | null;

	/** CASCADE theo §4.2; NULL = sự kiện không gắn khoá học (ví dụ `login`). */
	@ManyToOne(() => Course, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course | null;

	/**
	 * DDL thủ công:
	 * CREATE INDEX "idx_learning_events_lesson_occurred" ON "learning_events" ("lesson_id", "occurred_at" DESC);
	 */
	@Index('idx_learning_events_lesson_occurred', { synchronize: false })
	@Column({ type: 'uuid', name: 'lesson_id', nullable: true })
	lessonId: string | null;

	/** SET NULL: sự kiện là log bất biến, không được mất chỉ vì nội dung bị xoá (§4.2). */
	@ManyToOne(() => Lesson, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'lesson_id' })
	lesson: Lesson | null;

	@Column({ type: 'uuid', name: 'quiz_id', nullable: true })
	quizId: string | null;

	@ManyToOne(() => Quiz, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'quiz_id' })
	quiz: Quiz | null;

	@Column({ type: 'uuid', name: 'enrollment_id', nullable: true })
	enrollmentId: string | null;

	@ManyToOne(() => Enrollment, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'enrollment_id' })
	enrollment: Enrollment | null;

	/**
	 * DDL thủ công:
	 * CREATE INDEX "idx_learning_events_type_occurred" ON "learning_events" ("event_type", "occurred_at" DESC);
	 */
	@Index('idx_learning_events_type_occurred', { synchronize: false })
	@Column({ type: 'varchar', name: 'event_type', length: 40 })
	eventType: EventType;

	/**
	 * Thời điểm phía client báo — khoá partition tương lai (§5.3). Lệch nhiều so
	 * với `received_at` ⇒ đồng hồ client sai.
	 */
	@Column({ type: 'timestamptz', name: 'occurred_at', default: () => 'now()' })
	occurredAt: Date;

	/** Thời điểm server nhận; tách khỏi `occurred_at` để phát hiện sai đồng hồ client. */
	@Column({ type: 'timestamptz', name: 'received_at', default: () => 'now()' })
	receivedAt: Date;

	/** Gom các sự kiện trong cùng một phiên làm việc. */
	@Column({ type: 'uuid', name: 'session_id', nullable: true })
	sessionId: string | null;

	/** `NULL` hợp lệ (sự kiện không đo thời lượng) nên ràng buộc phải cho phép NULL. */
	@Column({ type: 'integer', name: 'duration_seconds', nullable: true })
	durationSeconds: number | null;

	/** Chỉ lưu hash, KHÔNG lưu IP thô (§6). */
	@Column({ type: 'varchar', name: 'ip_hash', length: 64, nullable: true })
	ipHash: string | null;

	@Column({ type: 'varchar', name: 'user_agent', length: 512, nullable: true })
	userAgent: string | null;

	/**
	 * Dữ liệu riêng theo từng `event_type`. NOT NULL default `'{}'::jsonb` và phải
	 * dùng chuỗi SQL: `default: {}` (object literal) khiến TypeORM sinh DDL sai (§8.7).
	 *
	 * Index GIN dưới đây là TUỲ CHỌN — chỉ tạo khi thật sự có truy vấn theo khoá
	 * trong `metadata`, vì GIN làm chậm ghi (§3.4.1):
	 * CREATE INDEX "idx_learning_events_metadata_gin" ON "learning_events" USING GIN ("metadata" jsonb_path_ops);
	 */
	@Index('idx_learning_events_metadata_gin', { synchronize: false })
	// Object literal, không dùng hàm — xem giải thích ở `notification.entity.ts`.
	@Column({ type: 'jsonb', name: 'metadata', default: {} })
	metadata: Record<string, unknown>;
}
