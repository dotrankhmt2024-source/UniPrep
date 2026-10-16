import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { User } from '../../user/entities/user.entity';

/**
 * Bảng `password_reset_tokens` (đặc tả `docs/02-specs/database-design.md` §3.1.3) — token dùng
 * **một lần** cho luồng quên mật khẩu (E1-T4).
 *
 * Vì sao tách bảng riêng thay vì nhét token vào `users`: một người có thể yêu cầu đặt lại nhiều
 * lần; lịch sử "yêu cầu lúc nào, đã dùng chưa" là dữ liệu kiểm toán, không phải thuộc tính của
 * tài khoản. Bảng này nằm **ngoài baseline 25 bảng của E0**, được thêm bằng migration riêng ở E1-T4.
 *
 * Vì sao chỉ lưu hash: cùng lý do với `refresh_tokens` — token gốc chỉ tồn tại trong email/log,
 * DB bị lộ thì hash SHA-256 không dùng lại được.
 */
@Entity('password_reset_tokens')
// Index phục vụ truy vấn "token mới nhất của người dùng" và việc dọn dẹp token hết hạn.
// Cột `expires_at` cần thứ tự DESC: DDL thủ công trong migration (TypeORM không biểu diễn được
// thứ tự cột bằng decorator) — xem `AddPasswordResetTokens`.
@Index('idx_password_reset_tokens_user', { synchronize: false })
@Index('uq_password_reset_tokens_token_hash', ['tokenHash'], { unique: true })
export class PasswordResetToken extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'user_id' })
	userId: string;

	/** ON DELETE CASCADE: yêu cầu đặt lại mật khẩu là dữ liệu cá nhân, xoá người dùng phải xoá theo. */
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User;

	/** Chỉ lưu hash (SHA-256) của token; token gốc không bao giờ vào DB. */
	@Column({ type: 'varchar', name: 'token_hash', length: 255 })
	tokenHash: string;

	/** TTL cấu hình qua `PASSWORD_RESET_TTL` (mặc định 30 phút) — không hard-code trong code. */
	@Column({ type: 'timestamptz', name: 'expires_at' })
	expiresAt: Date;

	/** NULL = chưa dùng. Dùng rồi thì mọi lần thử lại đều bị từ chối (§5.2). */
	@Column({ type: 'timestamptz', name: 'used_at', nullable: true })
	usedAt: Date | null;

	/** Hash của IP yêu cầu, không lưu IP thô (giảm dữ liệu cá nhân khi DB bị lộ). */
	@Column({
		type: 'varchar',
		name: 'requested_ip_hash',
		length: 64,
		nullable: true,
	})
	requestedIpHash: string | null;
}
