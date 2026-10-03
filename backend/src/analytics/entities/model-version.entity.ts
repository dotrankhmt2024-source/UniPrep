import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { User } from '../../user/entities/user.entity';

/**
 * Bảng `model_versions` (§3.4.2) — sổ đăng ký phiên bản model.
 *
 * Vì sao bảng này tồn tại: mọi dự đoán trong `risk_predictions` phải truy vết
 * được "dựa trên model nào" (yêu cầu bắt buộc của architecture.md §8 về audit và
 * của việc đánh giá model). Không lưu artifact/model ở đây, chỉ lưu tham chiếu:
 * `training_data_ref` (tập dữ liệu) và `artifact_uri` (đường dẫn file model).
 */
@Entity('model_versions')
@Index('uq_model_versions_name_version', ['name', 'version'], { unique: true })
export class ModelVersion extends BaseEntityCustom {
	/** Tên họ model, ví dụ `'risk-rule-based'`, `'risk-logreg'`. */
	@Column({ type: 'varchar', name: 'name', length: 100 })
	name: string;

	/** UNIQUE theo cặp `(name, version)` — một họ model không được trùng phiên bản. */
	@Column({ type: 'varchar', name: 'version', length: 30 })
	version: string;

	/**
	 * Tên thuật toán/chiến lược. Giá trị cụ thể do nhóm chốt — cố ý KHÔNG ghi tên
	 * thư viện chưa dùng vào tài liệu/entity.
	 */
	@Column({ type: 'varchar', name: 'algorithm', length: 50 })
	algorithm: string;

	/**
	 * Danh sách `feature_key` theo ĐÚNG thứ tự vector đầu vào — thứ tự là một phần
	 * ngữ nghĩa của model, không phải tập hợp tuỳ ý.
	 */
	// Object literal, không dùng hàm — xem giải thích ở `notification.entity.ts`.
	@Column({ type: 'jsonb', name: 'feature_list', default: [] })
	featureList: string[];

	@Column({ type: 'jsonb', name: 'hyperparams', nullable: true })
	hyperparams: Record<string, unknown> | null;

	/** Chỉ điền khi thực sự đo được (precision/recall...), không điền số mẫu. */
	@Column({ type: 'jsonb', name: 'metrics', nullable: true })
	metrics: Record<string, unknown> | null;

	/** Tham chiếu tới tập dữ liệu huấn luyện — không lưu dữ liệu trong bảng này. */
	@Column({
		type: 'varchar',
		name: 'training_data_ref',
		length: 512,
		nullable: true,
	})
	trainingDataRef: string | null;

	/** Đường dẫn file model đã huấn luyện. */
	@Column({
		type: 'varchar',
		name: 'artifact_uri',
		length: 512,
		nullable: true,
	})
	artifactUri: string | null;

	/**
	 * DDL thủ công (partial unique index — TypeORM chỉ hỗ trợ `where` ở index khai
	 * báo theo danh sách cột, không khai báo được ở dạng property placeholder):
	 * CREATE UNIQUE INDEX "uq_model_versions_active" ON "model_versions" ("name") WHERE "is_active";
	 *
	 * Vì sao partial: mỗi họ model chỉ được có TỐI ĐA MỘT phiên bản đang hoạt động,
	 * nhưng số phiên bản đã nghỉ hưu là không giới hạn → UNIQUE thường trên `name`
	 * sẽ sai.
	 */
	@Index('uq_model_versions_active', { synchronize: false })
	@Column({ type: 'boolean', name: 'is_active', default: false })
	isActive: boolean;

	@Column({ type: 'timestamptz', name: 'trained_at', nullable: true })
	trainedAt: Date | null;

	@Column({ type: 'timestamptz', name: 'activated_at', nullable: true })
	activatedAt: Date | null;

	@Column({ type: 'timestamptz', name: 'retired_at', nullable: true })
	retiredAt: Date | null;

	@Column({ type: 'text', name: 'notes', nullable: true })
	notes: string | null;

	/** Dữ liệu tham chiếu ⇒ SET NULL: giữ bản ghi model dù người tạo đã bị xoá (§4.2). */
	@Column({ type: 'uuid', name: 'created_by', nullable: true })
	createdBy: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'created_by' })
	creator: User | null;
}
