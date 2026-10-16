import { Check, Column, Entity, Index } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { UserRole, UserStatus } from '../../common/types';

/**
 * Bảng `users` (đặc tả `docs/02-specs/database-design.md` §3.1.1) — tài khoản duy nhất cho cả ba
 * vai trò (học viên / giảng viên / quản trị viên), gốc của RBAC và là chủ thể của mọi dữ liệu
 * hành vi. Thay thế bảng legacy `students`.
 *
 * Vì sao KHÔNG khai báo `@OneToMany` (`refreshTokens`, `ownedCourses`, `enrollments`):
 * các quan hệ đó trỏ tới entity của module khác, khai báo hai chiều sẽ tạo import vòng giữa các
 * module (`auth → user → auth`, `course → user → course`). Phía "nhiều" đã khai báo `@ManyToOne`
 * (`RefreshToken.user`, `Course.owner`, `Enrollment.user`) nên TypeORM vẫn có đủ metadata để join;
 * muốn lấy danh sách con thì dùng `QueryBuilder` hoặc repository của module sở hữu bảng đó.
 */
@Entity('users')
// Index phục vụ màn hình admin lọc theo vai trò + trạng thái (§3.1.1).
@Index('idx_users_role_status', ['role', 'status'])
// `student_code` chỉ duy nhất khi có giá trị: NULL (giảng viên/admin chưa gán mã) không tính là trùng.
@Index('uq_users_student_code', ['studentCode'], {
	unique: true,
	where: '"student_code" IS NOT NULL',
})
// Tập giá trị `role`/`status` ổn định nên đặt CHECK ở tầng DB, không chỉ dựa vào union type TS (§4.3).
@Check('chk_users_role', `"role" IN ('student', 'teacher', 'admin')`)
@Check(
	'chk_users_status',
	`"status" IN ('pending', 'active', 'suspended', 'disabled')`,
)
export class User extends BaseEntityCustom {
	// Index thật là UNIQUE (lower(email)) — index biểu thức nên không khai báo được bằng decorator;
	// placeholder dưới đây chỉ để TypeORM biết tên index, KHÔNG sinh DDL (synchronize: false).
	// DDL thủ công trong migration:
	//   CREATE UNIQUE INDEX "uq_users_email_lower" ON "users" (lower("email"));
	// (Đăng nhập không phân biệt hoa/thường và chặn hai tài khoản cùng email chỉ khác case.)
	@Index('uq_users_email_lower', { synchronize: false })
	@Column({ type: 'varchar', name: 'email', length: 255 })
	email: string;

	/**
	 * bcrypt (cost ≥ 10) hoặc argon2id. `select: false` để mọi truy vấn mặc định KHÔNG kéo cột này
	 * về — tránh lộ hash qua response API (§6); muốn đọc phải `addSelect()` tường minh khi đăng nhập.
	 */
	@Column({
		type: 'varchar',
		name: 'password_hash',
		length: 255,
		select: false,
	})
	passwordHash: string;

	@Column({ type: 'varchar', name: 'full_name', length: 255 })
	fullName: string;

	@Column({ type: 'varchar', name: 'role', length: 20, default: 'student' })
	role: UserRole;

	@Column({ type: 'varchar', name: 'status', length: 20, default: 'pending' })
	status: UserStatus;

	@Column({ type: 'varchar', name: 'phone', length: 20, nullable: true })
	phone: string | null;

	@Column({ type: 'varchar', name: 'avatar_url', length: 512, nullable: true })
	avatarUrl: string | null;

	@Column({ type: 'text', name: 'bio', nullable: true })
	bio: string | null;

	/** Giữ từ bảng legacy `students` (ngành học) để không mất dữ liệu khi migrate. */
	@Column({ type: 'varchar', name: 'major', length: 255, nullable: true })
	major: string | null;

	@Column({ type: 'varchar', name: 'student_code', length: 50, nullable: true })
	studentCode: string | null;

	/**
	 * Kiểu TS là `string` chứ không phải `Date`: với cột Postgres `date`, driver `pg` của TypeORM
	 * hydrate qua `DateUtils.mixedDateToDateString` → trả về chuỗi 'YYYY-MM-DD'. Giữ nguyên chuỗi
	 * để tránh lệch ngày do múi giờ (ngày sinh là ngày lịch, không phải một thời điểm).
	 */
	@Column({ type: 'date', name: 'date_of_birth', nullable: true })
	dateOfBirth: string | null;

	@Column({
		type: 'varchar',
		name: 'preferred_locale',
		length: 10,
		default: 'vi',
	})
	preferredLocale: string;

	/** NULL = chưa xác thực email (không dùng boolean để còn biết thời điểm xác thực). */
	@Column({ type: 'timestamptz', name: 'email_verified_at', nullable: true })
	emailVerifiedAt: Date | null;

	/** Phục vụ feature "tần suất đăng nhập N ngày" (architecture.md §7). */
	@Column({ type: 'timestamptz', name: 'last_login_at', nullable: true })
	lastLoginAt: Date | null;

	/** Đếm số lần đăng nhập sai để rate limit / tạm khoá tài khoản. */
	@Column({ type: 'smallint', name: 'failed_login_count', default: 0 })
	failedLoginCount: number;

	@Column({ type: 'timestamptz', name: 'locked_until', nullable: true })
	lockedUntil: Date | null;

	/**
	 * Soft delete (§3.3): xoá cứng sẽ mất ngữ cảnh của `learning_events`/`submissions` đã tham
	 * chiếu tới người dùng. NULL = còn hiệu lực.
	 */
	@Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
	deletedAt: Date | null;
}
