import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { NotificationChannel, NotificationType } from '../../common/types';
import { User } from '../../user/entities/user.entity';

/**
 * Thông báo trong ứng dụng/email/websocket cho học viên — bảng `notifications`
 * (database-design.md §3.5.2).
 *
 * Là kênh phát của pipeline cảnh báo sớm: khi `risk_predictions` sinh cờ rủi ro,
 * hệ thống gửi thông báo cá nhân hoá; badge chưa đọc là truy vấn nóng nhất nên có
 * partial index riêng (`idx_notifications_unread`).
 */
@Entity('notifications')
@Check(
	'chk_notifications_channel',
	`"channel" IN ('in_app', 'email', 'websocket')`,
)
export class Notification extends BaseEntityCustom {
	/**
	 * DDL thủ công (partial index + `DESC` — TypeORM không biểu diễn được):
	 * `CREATE INDEX "idx_notifications_unread" ON "notifications" ("user_id", "sent_at" DESC) WHERE "is_read" = false;`
	 */
	@Index('idx_notifications_unread', { synchronize: false })
	@Column({ type: 'uuid', name: 'user_id' })
	userId: string;

	/** Thông báo là dữ liệu thuộc sở hữu người dùng ⇒ CASCADE theo yêu cầu quyền riêng tư (§4.2). */
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User;

	/**
	 * Danh mục loại thông báo là tập mở (có thể thêm loại mới) nên §3.5.2 chỉ ràng buộc
	 * bằng union `NotificationType`, KHÔNG đặt CHECK — cùng lập luận như
	 * `learning_events.event_type` (§4.3).
	 */
	@Column({ type: 'varchar', name: 'notification_type', length: 30 })
	notificationType: NotificationType;

	@Column({ type: 'varchar', name: 'channel', length: 20, default: 'in_app' })
	channel: NotificationChannel;

	@Column({ type: 'varchar', name: 'title', length: 255 })
	title: string;

	/** Nội dung hiển thị cho người dùng: tiếng Việt (§1.1 #7). */
	@Column({ type: 'text', name: 'body' })
	body: string;

	/**
	 * Dữ liệu để FE mở đúng màn hình (deep-link, id đối tượng…).
	 *
	 * Vì sao object literal thay vì `() => "'{}'::jsonb"`: TypeORM chỉ deep-compare
	 * default của cột jsonb khi default KHÔNG phải hàm. Khai bằng hàm thì mỗi lần
	 * `schema:log` đều báo lệch default ⇒ job CI kiểm tra migration (E0-T8) đỏ
	 * vĩnh viễn dù schema đúng.
	 */
	@Column({ type: 'jsonb', name: 'payload', default: {} })
	payload: Record<string, unknown>;

	/**
	 * TODO(union): §3.5.2 liệt kê `'intervention' | 'risk_prediction' | 'lesson' | 'quiz'`
	 * nhưng `common/types` chưa có union tương ứng (ví dụ `NotificationRelatedType`)
	 * nên tạm dùng `string | null` — xem báo cáo cuối.
	 */
	@Column({ type: 'varchar', name: 'related_type', length: 30, nullable: true })
	relatedType: string | null;

	/**
	 * Tham chiếu đa hình tới nhiều bảng (`interventions`, `risk_predictions`,
	 * `lessons`, `quizzes`) nên KHÔNG thể có FK; toàn vẹn do tầng service đảm bảo (§4.5 #2).
	 */
	@Column({ type: 'uuid', name: 'related_id', nullable: true })
	relatedId: string | null;

	@Column({ type: 'boolean', name: 'is_read', default: false })
	isRead: boolean;

	@Column({ type: 'timestamptz', name: 'read_at', nullable: true })
	readAt: Date | null;

	/**
	 * DDL thủ công (index có `DESC` — TypeORM không biểu diễn được thứ tự sắp xếp):
	 * `CREATE INDEX "idx_notifications_user_time" ON "notifications" ("user_id", "sent_at" DESC);`
	 */
	@Index('idx_notifications_user_time', { synchronize: false })
	@Column({ type: 'timestamptz', name: 'sent_at', default: () => 'now()' })
	sentAt: Date;

	/** Chỉ có giá trị với kênh email (xác nhận từ nhà cung cấp dịch vụ gửi thư). */
	@Column({ type: 'timestamptz', name: 'delivered_at', nullable: true })
	deliveredAt: Date | null;

	@Column({
		type: 'varchar',
		name: 'failed_reason',
		length: 255,
		nullable: true,
	})
	failedReason: string | null;
}
