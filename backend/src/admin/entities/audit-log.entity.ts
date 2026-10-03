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
import { UserRole } from '../../common/types';
import { User } from '../../user/entities/user.entity';

/**
 * Nhật ký hành động quản trị và hành động hệ thống quan trọng — bảng `audit_logs`
 * (database-design.md §3.5.4).
 *
 * Bảng **append-only**: CHỈ có `created_at`, KHÔNG có `updated_at` (§1.1 #5), vì vậy
 * entity này **không** kế thừa `BaseEntityCustom` mà tự khai báo khoá chính + thời
 * điểm tạo. Không có API sửa/xoá dòng audit_logs; mọi thao tác ghi đi qua
 * interceptor/middleware của `AdminModule`.
 */
@Entity('audit_logs')
@Check('chk_audit_logs_status', `"status" IN ('success', 'failure')`)
export class AuditLog {
	@PrimaryGeneratedColumn('uuid', { name: 'id' })
	id: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt: Date;

	/**
	 * DDL thủ công (index có `DESC` — TypeORM không biểu diễn được thứ tự sắp xếp):
	 * `CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" ("actor_id", "created_at" DESC);`
	 */
	@Index('idx_audit_logs_actor', { synchronize: false })
	@Column({ type: 'uuid', name: 'actor_id', nullable: true })
	actorId: string | null;

	/** NULL = hành động do hệ thống/scheduler thực hiện. Tham chiếu ⇒ SET NULL (§4.2). */
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'actor_id' })
	actor: User | null;

	/**
	 * **Ảnh chụp** vai trò tại thời điểm hành động — vai trò của người dùng có thể đổi
	 * sau đó nên không suy ra từ `users.role` khi truy vết. §3.5.4 không đặt CHECK cho
	 * cột này (khác `users.role`) nên chỉ ràng buộc bằng union `UserRole`.
	 */
	@Column({ type: 'varchar', name: 'actor_role', length: 20, nullable: true })
	actorRole: UserRole | null;

	/**
	 * DDL thủ công (index có `DESC`):
	 * `CREATE INDEX "idx_audit_logs_action_time" ON "audit_logs" ("action", "created_at" DESC);`
	 */
	@Index('idx_audit_logs_action_time', { synchronize: false })
	@Column({ type: 'varchar', name: 'action', length: 60 })
	action: string;

	/**
	 * Ví dụ `'user.role_changed'`, `'course.published'`, `'report.resolved'`,
	 * `'alert_settings.updated'`, `'data.exported'`.
	 *
	 * DDL thủ công (index có `DESC`):
	 * `CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id", "created_at" DESC);`
	 */
	@Index('idx_audit_logs_entity', { synchronize: false })
	@Column({ type: 'varchar', name: 'entity_type', length: 50 })
	entityType: string;

	@Column({ type: 'uuid', name: 'entity_id', nullable: true })
	entityId: string | null;

	/** **Đã lọc bỏ trường nhạy cảm** — tuyệt đối không chứa `password_hash`/`token_hash` (§3.5.4, §6.3). */
	@Column({ type: 'jsonb', name: 'before_data', nullable: true })
	beforeData: Record<string, unknown> | null;

	/** Như `before_data`: ảnh chụp sau khi hành động, đã lọc trường nhạy cảm. */
	@Column({ type: 'jsonb', name: 'after_data', nullable: true })
	afterData: Record<string, unknown> | null;

	/** Hash của IP, KHÔNG lưu IP thô (§6). */
	@Column({ type: 'varchar', name: 'ip_hash', length: 64, nullable: true })
	ipHash: string | null;

	@Column({ type: 'varchar', name: 'user_agent', length: 512, nullable: true })
	userAgent: string | null;

	/** Truy vết một request xuyên nhiều dòng log. */
	@Column({ type: 'uuid', name: 'request_id', nullable: true })
	requestId: string | null;

	/**
	 * TODO(union): §3.5.4 chỉ định nghĩa `CHECK`, chưa có union cho kết quả hành động
	 * (ví dụ `AuditLogStatus`) trong `common/types` — tạm dùng `string`, xem báo cáo cuối.
	 */
	@Column({ type: 'varchar', name: 'status', length: 20, default: 'success' })
	status: string;
}
