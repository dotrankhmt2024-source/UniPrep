import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { RiskLevel } from '../../common/types';
import { Course } from '../../course/entities/course.entity';
import { Enrollment } from '../../course/entities/enrollment.entity';
import { User } from '../../user/entities/user.entity';
import { AIJob } from '../../ai-gateway/entities/ai-job.entity';
import { ModelVersion } from './model-version.entity';

/**
 * `numeric` của Postgres được driver `pg` trả về **string**; không có transformer
 * thì mọi phép tính trên `riskScore` sẽ sai (§8.7).
 */
const numericTransformer = {
	to: (value: number | null) => value,
	from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * Bảng `risk_predictions` (§3.4.3) — kết quả MỘT lần chấm điểm rủi ro cho một học
 * viên trong một khoá học: điểm, mức, ảnh chụp feature thô, giải thích và model đã
 * dùng. Đây là bảng dashboard giảng viên đọc.
 *
 * Vì sao có `updated_at` (khác `learning_events`): `is_current` bị lật khi có dự
 * đoán mới ⇒ dòng bị sửa tại chỗ, nên cần kế thừa `BaseEntityCustom` (§3.4.3).
 *
 * Cố ý KHÔNG khai báo `@OneToMany` tới `risk_feature_contributions`: bảng đó
 * không thuộc baseline E0, quan hệ ngược không cần cho truy vấn nào ở baseline.
 */
@Entity('risk_predictions')
@Check(
	'chk_risk_predictions_risk_score',
	'"risk_score" >= 0 AND "risk_score" <= 1',
)
@Check(
	'chk_risk_predictions_risk_level',
	"\"risk_level\" IN ('low', 'medium', 'high')",
)
@Check(
	'chk_risk_predictions_triggered_by',
	"\"triggered_by\" IN ('schedule', 'manual', 'event')",
)
export class RiskPrediction extends BaseEntityCustom {
	/**
	 * DDL thủ công:
	 * CREATE INDEX "idx_risk_predictions_user_time" ON "risk_predictions" ("user_id", "computed_at" DESC);
	 */
	@Index('idx_risk_predictions_user_time', { synchronize: false })
	@Column({ type: 'uuid', name: 'user_id' })
	userId: string;

	/** CASCADE: học viên được dự đoán — xoá cứng người dùng thì xoá cả dự đoán về họ (§4.2). */
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User;

	/**
	 * DDL thủ công:
	 * CREATE INDEX "idx_risk_predictions_course_level" ON "risk_predictions" ("course_id", "risk_level", "computed_at" DESC);
	 */
	@Index('idx_risk_predictions_course_level', { synchronize: false })
	@Column({ type: 'uuid', name: 'course_id', nullable: true })
	courseId: string | null;

	/** CASCADE theo §4.2; NULL = dự đoán toàn hệ thống (không gắn khoá học cụ thể). */
	@ManyToOne(() => Course, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course | null;

	@Column({ type: 'uuid', name: 'enrollment_id', nullable: true })
	enrollmentId: string | null;

	/** SET NULL: dự đoán vẫn phải giữ được nếu ghi danh bị xoá (§4.2). */
	@ManyToOne(() => Enrollment, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'enrollment_id' })
	enrollment: Enrollment | null;

	@Column({ type: 'uuid', name: 'model_version_id' })
	modelVersionId: string;

	/** RESTRICT: không cho xoá model đã từng sinh dự đoán — phá vỡ khả năng giải trình (§4.2). */
	@ManyToOne(() => ModelVersion, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'model_version_id' })
	modelVersion: ModelVersion;

	@Column({ type: 'uuid', name: 'ai_job_id', nullable: true })
	aiJobId: string | null;

	/** SET NULL: job chỉ là dấu vết thực thi, mất job không được làm mất dự đoán. */
	@ManyToOne(() => AIJob, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'ai_job_id' })
	aiJob: AIJob | null;

	/** Thang 0–1; CHECK ở cấp bảng vì ràng buộc khoảng giá trị không khai báo được ở cột. */
	@Column({
		type: 'numeric',
		name: 'risk_score',
		precision: 5,
		scale: 4,
		transformer: numericTransformer,
	})
	riskScore: number;

	@Column({ type: 'varchar', name: 'risk_level', length: 10 })
	riskLevel: RiskLevel;

	/** Nhãn nhị phân theo ngưỡng đang áp dụng → dùng để tính precision/recall. */
	@Column({ type: 'boolean', name: 'is_at_risk', default: false })
	isAtRisk: boolean;

	/**
	 * **Giá trị thô** của toàn bộ feature tại thời điểm dự đoán: nhờ nó mới tái lập
	 * được kết quả và giải thích được dự đoán cũ. NOT NULL default `{}`.
	 *
	 * Vì sao object literal chứ không phải chuỗi SQL: xem `notification.entity.ts`
	 * (`payload`) — default dạng hàm làm TypeORM báo lệch default jsonb mãi mãi.
	 */
	@Column({
		type: 'jsonb',
		name: 'feature_snapshot',
		default: {},
	})
	featureSnapshot: Record<string, unknown>;

	/** Câu giải thích tiếng Việt cho người dùng cuối (§1.1 quy ước 7). */
	@Column({ type: 'text', name: 'explanation_summary', nullable: true })
	explanationSummary: string | null;

	/** Cửa sổ dự báo; 14 ngày là điểm khởi đầu cần tinh chỉnh, không phải số đã kiểm chứng. */
	@Column({ type: 'integer', name: 'horizon_days', default: 14 })
	horizonDays: number;

	@Column({ type: 'timestamptz', name: 'computed_at', default: () => 'now()' })
	computedAt: Date;

	/**
	 * DDL thủ công (partial unique index trên biểu thức `COALESCE` — TypeORM không
	 * biểu diễn được cả biểu thức lẫn `WHERE` partial):
	 * CREATE UNIQUE INDEX "uq_risk_predictions_current"
	 * 	ON "risk_predictions" ("user_id", COALESCE("course_id", '00000000-0000-0000-0000-000000000000'::uuid), "model_version_id")
	 * 	WHERE "is_current";
	 *
	 * Vì sao `COALESCE`: `course_id` NULL (dự đoán toàn hệ thống) nếu để nguyên thì
	 * Postgres coi mỗi NULL là khác nhau → sinh nhiều dòng current trùng.
	 */
	@Index('uq_risk_predictions_current', { synchronize: false })
	@Column({ type: 'boolean', name: 'is_current', default: true })
	isCurrent: boolean;

	/** Nguồn sinh dự đoán; union chỉ có 3 giá trị ổn định nên đặt CHECK (§4.3). */
	@Column({
		type: 'varchar',
		name: 'triggered_by',
		length: 20,
		default: 'schedule',
	})
	triggeredBy: 'schedule' | 'manual' | 'event';
}
