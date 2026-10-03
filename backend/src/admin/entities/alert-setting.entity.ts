import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { Course } from '../../course/entities/course.entity';
import { User } from '../../user/entities/user.entity';

/**
 * `pg` trả cột `numeric` về **string**, không phải number (§8.7). Nếu không chuyển
 * kiểu thì mọi so sánh ngưỡng (`risk_score >= threshold_high`) sẽ so sánh chuỗi
 * và sai kết quả.
 */
const numericTransformer = {
	to: (value: number | null) => value,
	from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * Cấu hình ngưỡng cảnh báo do admin quản lý — bảng `alert_settings` (§3.5.3).
 *
 * Có hai phạm vi: `global` (một dòng duy nhất, `course_id` NULL) và `course`
 * (một khoá có thể dùng ngưỡng riêng). Unique index dùng `COALESCE` để NULL không
 * tạo khe hở trùng lặp (§4.1).
 *
 * ⚠️ Mọi giá trị mặc định ở đây là **điểm khởi đầu đề xuất**, không phải ngưỡng đã
 * kiểm chứng bằng dữ liệu (§3.5.3).
 */
@Entity('alert_settings')
@Check('chk_alert_settings_scope', `"scope" IN ('global', 'course')`)
@Check(
	'chk_alert_settings_threshold_medium',
	`"threshold_medium" >= 0 AND "threshold_medium" <= 1`,
)
@Check(
	'chk_alert_settings_threshold_high',
	`"threshold_high" >= "threshold_medium" AND "threshold_high" <= 1`,
)
export class AlertSetting extends BaseEntityCustom {
	/**
	 * TODO(union): §3.5.3 chỉ định nghĩa `CHECK`, chưa có union cho phạm vi cấu hình
	 * (ví dụ `AlertScope`) trong `common/types` — tạm dùng `string`, xem báo cáo cuối.
	 */
	@Column({ type: 'varchar', name: 'scope', length: 20, default: 'global' })
	scope: string;

	/**
	 * DDL thủ công (unique index có biểu thức `COALESCE` — TypeORM không biểu diễn được):
	 * `CREATE UNIQUE INDEX "uq_alert_settings_scope" ON "alert_settings" ("scope", COALESCE("course_id", '00000000-0000-0000-0000-000000000000'::uuid));`
	 */
	@Index('uq_alert_settings_scope', { synchronize: false })
	@Column({ type: 'uuid', name: 'course_id', nullable: true })
	courseId: string | null;

	/** NULL khi `scope = 'global'`; xoá khoá học thì cấu hình riêng của khoá cũng hết ý nghĩa (§4.2). */
	@ManyToOne(() => Course, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course | null;

	/**
	 * Ngưỡng dưới ⇒ mức rủi ro `medium`.
	 *
	 * Vì sao default là hàm trả CHUỖI (`() => '0.4'`) chứ không phải số `0.4`:
	 * Postgres lưu default của `numeric` ở dạng không nháy (`0.4`), còn TypeORM
	 * chuẩn hoá số thành `'0.4'` (có nháy) ⇒ luôn báo lệch trong `schema:log`.
	 * Hàm trả chuỗi thô khớp đúng giá trị Postgres trả về.
	 */
	@Column({
		type: 'numeric',
		name: 'threshold_medium',
		precision: 5,
		scale: 4,
		default: () => '0.4',
		transformer: numericTransformer,
	})
	thresholdMedium: number;

	/** Ngưỡng trên ⇒ mức rủi ro `high`. Cùng lý do default dạng hàm như trên. */
	@Column({
		type: 'numeric',
		name: 'threshold_high',
		precision: 5,
		scale: 4,
		default: () => '0.7',
		transformer: numericTransformer,
	})
	thresholdHigh: number;

	/** Cửa sổ ngày dùng để tính feature cho model. */
	@Column({ type: 'smallint', name: 'lookback_days', default: 14 })
	lookbackDays: number;

	/** Số ngày không có hoạt động nào thì coi là "không hoạt động". */
	@Column({ type: 'smallint', name: 'inactivity_days', default: 7 })
	inactivityDays: number;

	/** Dưới ngưỡng này thì KHÔNG kết luận rủi ro — tránh gắn cờ học viên mới (§3.5.3). */
	@Column({ type: 'smallint', name: 'min_events_for_prediction', default: 5 })
	minEventsForPrediction: number;

	/** Ngưỡng "số lần làm lại bất thường" của một quiz. */
	@Column({ type: 'smallint', name: 'retry_attempt_threshold', default: 3 })
	retryAttemptThreshold: number;

	/** Bật = tự gửi can thiệp; tắt = chỉ gắn cờ để giảng viên xử lý. */
	@Column({
		type: 'boolean',
		name: 'auto_intervention_enabled',
		default: false,
	})
	autoInterventionEnabled: boolean;

	@Column({ type: 'boolean', name: 'notify_student', default: true })
	notifyStudent: boolean;

	@Column({ type: 'boolean', name: 'notify_instructor', default: true })
	notifyInstructor: boolean;

	/** Lịch chạy pipeline dự đoán (cron 5 trường). */
	@Column({
		type: 'varchar',
		name: 'schedule_cron',
		length: 50,
		default: '0 2 * * *',
	})
	scheduleCron: string;

	@Column({ type: 'boolean', name: 'is_enabled', default: true })
	isEnabled: boolean;

	@Column({ type: 'uuid', name: 'updated_by', nullable: true })
	updatedById: string | null;

	/** Dữ liệu tham chiếu ⇒ SET NULL: cấu hình vẫn còn giá trị dù admin đã bị xoá (§4.2). */
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'updated_by' })
	updatedBy: User | null;
}
