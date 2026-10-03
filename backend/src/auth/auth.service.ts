import {
	BadRequestException,
	ConflictException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { toUserProfile } from '../user/user.mapper';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { MailService } from './mail/mail.service';
import { TokenService, type SessionContext } from './token.service';
import { AUTH_MESSAGE } from './constants/auth-message.constant';
import {
	DEFAULT_BCRYPT_SALT_ROUNDS,
	DUMMY_PASSWORD_HASH,
	LOGIN_LOCKOUT_MINUTES,
	LOGIN_MAX_FAILED_ATTEMPTS,
} from './constants/auth.constant';
import { assertAccountUsable } from './account-status.util';
import {
	PASSWORD_RESET_DEFAULT_TTL_MS,
	parseTtlToMs,
} from '../common/utils/ttl.util';
import type { RegisterDto } from './dto/register.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type {
	AuthSession,
	TokenPair,
	UserProfile,
} from './types/authenticated-user.type';

/** Mã lỗi Postgres cho vi phạm ràng buộc UNIQUE. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Nghiệp vụ xác thực (E1-T1, E1-T2, E1-T4, E1-T5).
 *
 * Nguyên tắc bảo mật được áp dụng ở đây:
 * 1. **Hash bcrypt** (cost từ `BCRYPT_SALT_ROUNDS`, mặc định 10 — chốt của nhóm) và cột
 *    `password_hash` là `select: false` nên không truy vấn nào vô tình trả hash ra response.
 * 2. **Không tiết lộ email có tồn tại hay không**: đăng nhập sai luôn trả cùng một message;
 *    `forgot-password` luôn trả cùng một kết quả và **luôn 200** (§5.2, §5.3).
 * 3. **Chống dò mật khẩu**: đếm `failed_login_count`, đủ ngưỡng thì khoá `locked_until`
 *    (E1-T5). Ngưỡng lấy từ api-specification §12.
 */
@Injectable()
export class AuthService {
	constructor(
		@InjectRepository(User)
		private readonly users: Repository<User>,
		@InjectRepository(PasswordResetToken)
		private readonly resetTokens: Repository<PasswordResetToken>,
		private readonly tokenService: TokenService,
		private readonly mailService: MailService,
		private readonly configService: ConfigService,
	) {}

	// ---------------------------------------------------------------- tiện ích

	private get saltRounds(): number {
		const configured = Number(
			this.configService.get<string>('BCRYPT_SALT_ROUNDS'),
		);
		return Number.isFinite(configured) && configured > 0
			? configured
			: DEFAULT_BCRYPT_SALT_ROUNDS;
	}

	private toProfile(user: User): UserProfile {
		return toUserProfile(user);
	}

	/**
	 * Truy vấn theo `LOWER(email)`: khớp đúng index `uq_users_email_lower` và cho phép người dùng
	 * gõ email hoa/thường tuỳ ý khi đăng nhập (cùng một tài khoản, không tạo bản ghi thứ hai).
	 */
	private buildEmailQuery(email: string) {
		return this.users
			.createQueryBuilder('user')
			.where('LOWER(user.email) = LOWER(:email)', { email });
	}

	private async hashPassword(plain: string): Promise<string> {
		return bcrypt.hash(plain, this.saltRounds);
	}

	// ------------------------------------------------------------- E1-T1 đăng ký

	async register(
		dto: RegisterDto,
		session: SessionContext = {},
	): Promise<AuthSession> {
		const existing = await this.buildEmailQuery(dto.email).getOne();
		if (existing) throw new ConflictException(AUTH_MESSAGE.emailTaken);

		if (dto.studentCode) {
			const duplicatedCode = await this.users.findOne({
				where: { studentCode: dto.studentCode },
			});
			if (duplicatedCode) {
				throw new ConflictException(AUTH_MESSAGE.studentCodeTaken);
			}
		}

		const user = this.users.create({
			email: dto.email,
			passwordHash: await this.hashPassword(dto.password),
			fullName: dto.fullName,
			// Không nhận `role` từ client (§5.2): mặc định học viên, tránh leo thang đặc quyền.
			role: 'student',
			// `active` ngay sau đăng ký để luồng "đăng ký xong dùng được ngay" của §5.3 hoạt động;
			// `pending` dành cho tài khoản do admin tạo và chưa kích hoạt (E1-T5).
			status: 'active',
			studentCode: dto.studentCode ?? null,
		});

		try {
			const saved = await this.users.save(user);
			const pair = await this.tokenService.issuePair(saved, session);
			return { ...pair, user: this.toProfile(saved) };
		} catch (error) {
			// Hai request đăng ký cùng email chạy song song: cả hai đều qua bước kiểm tra tồn tại,
			// tới lúc INSERT thì index UNIQUE chặn. Dịch lỗi DB thành 409 thay vì để lọt 500.
			if (
				error instanceof QueryFailedError &&
				(error.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
			) {
				throw new ConflictException(AUTH_MESSAGE.emailTaken);
			}
			throw error;
		}
	}

	// ------------------------------------------------------------ E1-T1 đăng nhập

	/**
	 * Kiểm tra thông tin đăng nhập cho `LocalStrategy`. Trả về `User` để controller phát hành token.
	 *
	 * Thứ tự kiểm tra **có chủ ý**: mật khẩu → khoá tạm → trạng thái. Nhờ vậy khi tài khoản đang bị
	 * khoá, người gõ sai mật khẩu vẫn nhận `401` chung (không dò được tài khoản nào đang bị khoá),
	 * còn người gõ **đúng** mật khẩu nhận `403` kèm lý do cụ thể — đúng DoD E1-T5.
	 */
	async validateCredentials(email: string, password: string): Promise<User> {
		const user = await this.buildEmailQuery(email)
			.addSelect('user.passwordHash')
			.getOne();

		if (!user) {
			// So sánh với hash giả để thời gian phản hồi không khác biệt so với email có thật.
			await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
			throw new UnauthorizedException(AUTH_MESSAGE.invalidCredentials);
		}

		const matches = await bcrypt.compare(password, user.passwordHash);
		if (!matches) {
			await this.registerFailedAttempt(user);
			throw new UnauthorizedException(AUTH_MESSAGE.invalidCredentials);
		}

		// Khoá tạm (sai nhiều lần) và trạng thái tài khoản đều được kiểm tra ở đây, **sau** khi mật
		// khẩu đã đúng — xem ghi chú về thứ tự kiểm tra ở docblock của method.
		assertAccountUsable(user);

		return user;
	}

	/**
	 * Ghi nhận một lần đăng nhập sai. Khi chạm ngưỡng thì đặt `locked_until` và **đưa bộ đếm về 0**:
	 * nếu giữ nguyên bộ đếm, lần sai đầu tiên sau khi hết hạn khoá sẽ khoá tài khoản trở lại ngay.
	 */
	private async registerFailedAttempt(user: User): Promise<void> {
		const failedCount = user.failedLoginCount + 1;

		if (failedCount >= LOGIN_MAX_FAILED_ATTEMPTS) {
			await this.users.update(
				{ id: user.id },
				{
					failedLoginCount: 0,
					lockedUntil: new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000),
				},
			);
			return;
		}

		await this.users.update({ id: user.id }, { failedLoginCount: failedCount });
	}

	/** Phát hành phiên mới và ghi dấu lần đăng nhập thành công. */
	async login(user: User, session: SessionContext = {}): Promise<AuthSession> {
		await this.users.update(
			{ id: user.id },
			{
				failedLoginCount: 0,
				lockedUntil: null,
				lastLoginAt: new Date(),
			},
		);

		const pair = await this.tokenService.issuePair(user, session);
		return { ...pair, user: this.toProfile(user) };
	}

	// ------------------------------------------------------- E1-T2 vòng đời token

	/** Xoay cặp token; mọi kiểm tra (chữ ký, thu hồi, hết hạn, trạng thái) nằm trong `TokenService`. */
	async refresh(
		refreshToken: string,
		session: SessionContext = {},
	): Promise<TokenPair> {
		const { pair } = await this.tokenService.rotate(refreshToken, session);
		return pair;
	}

	/**
	 * Kết thúc phiên (§5.2). Có gửi `refreshToken` và token đó thuộc người dùng ⇒ chỉ thu hồi phiên
	 * đó; không gửi (hoặc token không hợp lệ) ⇒ thu hồi **mọi** phiên đang hoạt động.
	 */
	async logout(
		userId: string,
		refreshToken?: string,
	): Promise<{ success: true }> {
		const revokedOne = refreshToken
			? await this.tokenService.revokeSession(refreshToken, userId, 'logout')
			: false;

		if (!revokedOne) {
			await this.tokenService.revokeAllForUser(userId, 'logout');
		}

		return { success: true };
	}

	// --------------------------------------------------- E1-T4 quên/đặt lại mật khẩu

	/**
	 * Tạo token đặt lại mật khẩu và "gửi email" (dev: ghi log — §5.2).
	 *
	 * **Luôn trả về cùng một kết quả** dù email có tồn tại hay không: nếu chỉ trả 200 khi email có
	 * thật thì endpoint này trở thành công cụ dò danh sách người dùng.
	 */
	async forgotPassword(
		email: string,
		session: Pick<SessionContext, 'ip'> = {},
	): Promise<{ success: true }> {
		const user = await this.buildEmailQuery(email)
			.andWhere('user.deletedAt IS NULL')
			.getOne();

		if (user) {
			const token = randomBytes(32).toString('hex');
			const ttlMs = parseTtlToMs(
				this.configService.get<string>('PASSWORD_RESET_TTL'),
				PASSWORD_RESET_DEFAULT_TTL_MS,
			);
			const expiresAt = new Date(Date.now() + ttlMs);

			// Yêu cầu mới vô hiệu hoá các token chưa dùng trước đó: chỉ link mới nhất còn hiệu lực,
			// nên hộp thư cũ bị lộ cũng không mở lại được đường đặt mật khẩu.
			await this.resetTokens.update(
				{ userId: user.id, usedAt: IsNull() },
				{ usedAt: new Date() },
			);
			await this.resetTokens.save(
				this.resetTokens.create({
					userId: user.id,
					tokenHash: this.tokenService.hashToken(token),
					expiresAt,
					usedAt: null,
					requestedIpHash: this.tokenService.hashIp(session.ip),
				}),
			);

			await this.mailService.sendPasswordResetToken(
				user.email,
				token,
				expiresAt,
			);
		}

		return { success: true };
	}

	/**
	 * Đặt lại mật khẩu bằng token một lần (§5.2): token phải tồn tại, chưa dùng và chưa hết hạn.
	 * Sau khi đổi, **thu hồi toàn bộ refresh token** của người dùng — kẻ chiếm được email cũng
	 * không giữ được phiên đang mở.
	 */
	async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
		const row = await this.resetTokens.findOne({
			where: { tokenHash: this.tokenService.hashToken(dto.token) },
		});

		if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
			throw new BadRequestException(AUTH_MESSAGE.invalidResetToken);
		}

		const user = await this.users.findOne({ where: { id: row.userId } });
		if (!user || user.deletedAt) {
			throw new BadRequestException(AUTH_MESSAGE.invalidResetToken);
		}

		await this.users.update(
			{ id: user.id },
			{
				passwordHash: await this.hashPassword(dto.password),
				// Người dùng đã chứng minh quyền sở hữu email ⇒ mở luôn khoá tạm do đăng nhập sai.
				failedLoginCount: 0,
				lockedUntil: null,
			},
		);
		await this.resetTokens.update({ id: row.id }, { usedAt: new Date() });
		await this.tokenService.revokeAllForUser(user.id, 'password_reset');

		return { success: true };
	}

	/** Đổi mật khẩu khi đã đăng nhập (§5.3) — E2-T1 sẽ tái sử dụng qua `UserModule`. */
	async changePassword(
		userId: string,
		dto: ChangePasswordDto,
	): Promise<{ success: true }> {
		const user = await this.users
			.createQueryBuilder('user')
			.addSelect('user.passwordHash')
			.where('user.id = :userId', { userId })
			.getOne();

		if (!user || user.deletedAt) {
			throw new UnauthorizedException(AUTH_MESSAGE.invalidSession);
		}

		const matches = await bcrypt.compare(
			dto.currentPassword,
			user.passwordHash,
		);
		// `400` chứ không `401`: người dùng ĐÃ xác thực thành công, chỉ có dữ liệu gửi lên sai. Trả
		// `401` còn kéo theo hệ quả ở FE — interceptor coi mọi `401` là "access token hết hạn" nên sẽ
		// xoay refresh token vô ích mỗi lần người dùng gõ nhầm mật khẩu cũ (xem E2-T1, DoD ghi rõ 400).
		if (!matches) {
			throw new BadRequestException(AUTH_MESSAGE.wrongCurrentPassword);
		}

		// So sánh bằng hash chứ không so chuỗi: người dùng có thể gõ lại mật khẩu cũ với hoa/thường
		// khác nhưng vẫn là cùng một mật khẩu.
		if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
			throw new BadRequestException(AUTH_MESSAGE.samePassword);
		}

		await this.users.update(
			{ id: user.id },
			{ passwordHash: await this.hashPassword(dto.newPassword) },
		);
		await this.tokenService.revokeAllForUser(user.id, 'password_changed');

		return { success: true };
	}

	// ------------------------------------------------------------- E1-T3 hồ sơ

	/** `GET /api/auth/me` — đọc lại từ DB để phản ánh thay đổi vai trò/trạng thái ngay lập tức. */
	async getProfile(userId: string): Promise<UserProfile> {
		const user = await this.users.findOne({ where: { id: userId } });
		if (!user || user.deletedAt) {
			throw new UnauthorizedException(AUTH_MESSAGE.invalidSession);
		}

		assertAccountUsable(user);

		return this.toProfile(user);
	}
}
