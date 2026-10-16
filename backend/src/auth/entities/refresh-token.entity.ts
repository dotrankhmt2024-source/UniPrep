import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { User } from '../../user/entities/user.entity';

/**
 * Bảng `refresh_tokens` (đặc tả `docs/02-specs/database-design.md` §3.1.2) — lưu refresh token đã
 * phát hành để thu hồi, xoay token (rotation) và phát hiện tái sử dụng token.
 *
 * Vì sao chỉ lưu hash: token gốc nằm ở client, nếu DB bị lộ thì hash SHA-256 không dùng lại được
 * (cột `token_hash` là UNIQUE — cùng một token không thể tồn tại hai lần, và UNIQUE còn tăng tốc
 * truy vấn tra cứu token khi refresh).
 *
 * Vì sao KHÔNG khai báo `@OneToMany` tới các bảng khác: tránh import vòng giữa module; quan hệ
 * `@ManyToOne` ở phía này đã đủ metadata.
 */
@Entity('refresh_tokens')
// Index phục vụ hai truy vấn nóng: (a) kiểm tra token còn hiệu lực của một người dùng
// (`WHERE user_id = ? AND revoked_at IS NULL AND expires_at > now()`), (b) thu hồi cả family khi
// phát hiện reuse. Partial index chỉ chứa token chưa thu hồi nên nhỏ hơn nhiều so với index đầy đủ.
@Index('idx_refresh_tokens_user_active', ['userId', 'expiresAt'], {
	where: '"revoked_at" IS NULL',
})
@Index('idx_refresh_tokens_family', ['familyId'])
// UNIQUE trên hash là ràng buộc nghiệp vụ (một token chỉ có một dòng), nên khai báo index unique
// thay vì `unique: true` trên cột để kiểm soát được tên ràng buộc trong migration.
@Index('uq_refresh_tokens_token_hash', ['tokenHash'], { unique: true })
// CHECK so sánh hai cột: TypeORM hỗ trợ biểu thức tuỳ ý, và đây là ràng buộc toàn vẹn duy nhất của
// bảng (token hết hạn trước khi phát hành là dữ liệu vô nghĩa, không thể phát hiện ở tầng service).
@Check('chk_refresh_tokens_expires_at', '"expires_at" > "issued_at"')
export class RefreshToken extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'user_id' })
	userId: string;

	// ON DELETE CASCADE: token là dữ liệu thuộc sở hữu người dùng — xoá cứng người dùng phải xoá
	// sạch dữ liệu cá nhân (yêu cầu quyền riêng tư, §4.2).
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User;

	/** Chỉ lưu hash (SHA-256) của token, KHÔNG bao giờ lưu token gốc. */
	@Column({ type: 'varchar', name: 'token_hash', length: 255 })
	tokenHash: string;

	/** Nhóm token của cùng một chuỗi rotation; phát hiện reuse → thu hồi cả family. */
	@Column({ type: 'uuid', name: 'family_id' })
	familyId: string;

	/** Ghi bằng `now()` của Postgres để không lệ thuộc đồng hồ ứng dụng. */
	@Column({ type: 'timestamptz', name: 'issued_at', default: () => 'now()' })
	issuedAt: Date;

	@Column({ type: 'timestamptz', name: 'expires_at' })
	expiresAt: Date;

	/** NULL = còn hiệu lực (đây là cột mà partial index ở trên lọc theo). */
	@Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
	revokedAt: Date | null;

	/**
	 * Tài liệu §3.1.2 liệt kê bốn giá trị ('logout', 'rotated', 'reuse_detected', 'admin_revoke')
	 * nhưng không yêu cầu `CHECK` và chưa có union type riêng, nên cột để kiểu `string` tự do.
	 * Nếu muốn chặn cứng ở DB, thêm DDL (xem báo cáo): CHECK (revoked_reason IN (...)).
	 */
	@Column({
		type: 'varchar',
		name: 'revoked_reason',
		length: 100,
		nullable: true,
	})
	revokedReason: string | null;

	@Column({ type: 'uuid', name: 'replaced_by_token_id', nullable: true })
	replacedByTokenId: string | null;

	// Self-FK ON DELETE SET NULL: giữ dòng token cũ (dấu vết rotation) ngay cả khi token thay thế
	// bị xoá; NULL hoá thay vì xoá dây chuyền để không mất lịch sử phát hiện reuse.
	@ManyToOne(() => RefreshToken, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'replaced_by_token_id' })
	replacedByToken: RefreshToken | null;

	/** Hash của IP, không lưu IP thô (giảm dữ liệu cá nhân khi bị lộ DB). */
	@Column({ type: 'varchar', name: 'ip_hash', length: 64, nullable: true })
	ipHash: string | null;

	@Column({ type: 'varchar', name: 'user_agent', length: 512, nullable: true })
	userAgent: string | null;
}
