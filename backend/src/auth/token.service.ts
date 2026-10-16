import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../user/entities/user.entity';
import { AUTH_MESSAGE } from './constants/auth-message.constant';
import { assertAccountUsable } from './account-status.util';
import type { RefreshTokenRevokedReason } from '../common/types';
import type {
	AccessTokenPayload,
	RefreshTokenPayload,
	TokenPair,
} from './types/authenticated-user.type';

/**
 * Kiểu TTL mà `jsonwebtoken` chấp nhận cho `expiresIn`. Lấy trực tiếp từ option của `@nestjs/jwt`
 * thay vì import `StringValue` của package `ms`: giá trị đọc từ `.env` luôn là `string`, nên cần
 * một chỗ cast có kiểm soát, và kiểu này sẽ tự đổi theo phiên bản thư viện.
 */
type ExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

/** Thông tin phiên đi kèm mỗi lần phát hành token (đã có `ip` thô, service tự hash). */
export interface SessionContext {
	ip?: string | null;
	userAgent?: string | null;
}

/**
 * Nơi duy nhất phát hành / xoay / thu hồi token (E1-T2).
 *
 * Quyết định thiết kế:
 * 1. **Access token là JWT**, **refresh token cũng là JWT** nhưng mang thêm `type: 'refresh'` và
 *    `familyId` — dùng chung `JWT_SECRET` (đúng §5.1: HS256, một secret) và phân biệt bằng claim
 *    `type`. Nhờ vậy `refresh_tokens` vẫn lưu được hash để thu hồi/rotation như thiết kế DB, mà
 *    không phải thêm biến môi trường `JWT_REFRESH_SECRET` ngoài danh sách đã chốt ở §14.1.
 * 2. **`expires_at` lấy từ claim `exp` của chính token** thay vì tự cộng TTL: hai nguồn TTL
 *    (chuỗi `JWT_REFRESH_TTL` và `Date`) không thể lệch nhau, nên không có cửa sổ mà DB coi token
 *    còn hạn nhưng chữ ký đã hết hạn (hoặc ngược lại).
 * 3. **Mọi lỗi token trả cùng một message** `invalidSession` — phân biệt "token sai chữ ký" với
 *    "token đã thu hồi" sẽ giúp kẻ tấn công dò được token nào từng tồn tại.
 */
@Injectable()
export class TokenService {
	constructor(
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		@InjectRepository(RefreshToken)
		private readonly refreshTokens: Repository<RefreshToken>,
		@InjectRepository(User)
		private readonly users: Repository<User>,
	) {}

	/** SHA-256 hex (64 ký tự) — vừa `token_hash varchar(255)` vừa `ip_hash varchar(64)`. */
	hashToken(raw: string): string {
		return createHash('sha256').update(raw).digest('hex');
	}

	hashIp(ip?: string | null): string | null {
		return ip ? createHash('sha256').update(ip).digest('hex') : null;
	}

	private get accessTtl(): ExpiresIn {
		return (this.configService.get<string>('JWT_ACCESS_TTL') ??
			'15m') as ExpiresIn;
	}

	private get refreshTtl(): ExpiresIn {
		return (this.configService.get<string>('JWT_REFRESH_TTL') ??
			'7d') as ExpiresIn;
	}

	/** Ký access token và trả kèm số giây còn hiệu lực cho trường `expiresIn` của response. */
	private async signAccessToken(user: User): Promise<{
		token: string;
		expiresIn: number;
	}> {
		const payload: AccessTokenPayload = {
			sub: user.id,
			email: user.email,
			role: user.role,
			type: 'access',
		};

		const token = await this.jwtService.signAsync(payload, {
			expiresIn: this.accessTtl,
		});
		const decoded = this.jwtService.decode<AccessTokenPayload>(token);

		return {
			token,
			expiresIn: decoded?.exp && decoded?.iat ? decoded.exp - decoded.iat : 0,
		};
	}

	/** Ký refresh token rồi ghi một dòng `refresh_tokens` (chỉ hash) — dòng này là "phiên". */
	private async createRefreshSession(
		user: User,
		familyId: string,
		session: SessionContext,
	): Promise<{ token: string; row: RefreshToken }> {
		const jti = randomUUID();
		// `jti` KHÔNG đặt trong payload: jsonwebtoken từ chối khi payload đã có `jti` mà option
		// `jwtid` cũng được truyền ("Bad options.jwtid option"). Nó tự thêm claim `jti` từ `jwtid`.
		const payload: Omit<RefreshTokenPayload, 'jti'> = {
			sub: user.id,
			familyId,
			type: 'refresh',
		};

		const token = await this.jwtService.signAsync(payload, {
			expiresIn: this.refreshTtl,
			// Ghi `jti` tường minh để chuỗi token là duy nhất kể cả khi payload + `iat` trùng nhau
			// (xem ghi chú ở `RefreshTokenPayload.jti`).
			jwtid: jti,
		});
		const decoded = this.jwtService.decode<RefreshTokenPayload>(token);

		const row = this.refreshTokens.create({
			userId: user.id,
			tokenHash: this.hashToken(token),
			familyId,
			issuedAt: new Date(),
			expiresAt: new Date((decoded?.exp ?? 0) * 1000),
			revokedAt: null,
			revokedReason: null,
			replacedByTokenId: null,
			ipHash: this.hashIp(session.ip),
			// Cột là varchar(512): cắt bớt thay vì để DB ném lỗi 22001 với User-Agent dài.
			userAgent: session.userAgent ? session.userAgent.slice(0, 512) : null,
		});

		return { token, row: await this.refreshTokens.save(row) };
	}

	private async verifyRefreshToken(
		rawToken: string,
	): Promise<RefreshTokenPayload> {
		try {
			const payload =
				await this.jwtService.verifyAsync<RefreshTokenPayload>(rawToken);

			// Chặn dùng access token như refresh token (và ngược lại): thiếu `familyId` là token
			// không thuộc bảng `refresh_tokens` nên không thể thu hồi ⇒ không được chấp nhận.
			if (payload.type !== 'refresh' || !payload.familyId) {
				throw new UnauthorizedException(AUTH_MESSAGE.invalidSession);
			}

			return payload;
		} catch {
			throw new UnauthorizedException(AUTH_MESSAGE.invalidSession);
		}
	}

	private toTokenPair(
		accessToken: string,
		expiresIn: number,
		refreshToken: string,
	): TokenPair {
		return {
			accessToken,
			refreshToken,
			tokenType: 'Bearer',
			expiresIn,
		};
	}

	/** Phát cặp token cho một phiên **mới** (đăng nhập, đăng ký). */
	async issuePair(
		user: User,
		session: SessionContext = {},
	): Promise<TokenPair> {
		const familyId = randomUUID();
		const access = await this.signAccessToken(user);
		const refresh = await this.createRefreshSession(user, familyId, session);

		return this.toTokenPair(access.token, access.expiresIn, refresh.token);
	}

	/**
	 * Xoay token (one-time-use, §5.2). Trả về cả `user` để tầng gọi không phải truy vấn lại.
	 *
	 * Ba nhánh từ chối:
	 * - token không có trong DB / sai chữ ký / hết hạn ⇒ `401`;
	 * - token **đã thu hồi** mà vẫn được dùng ⇒ `401` **và thu hồi toàn bộ phiên của người dùng**
	 *   (dấu hiệu token bị đánh cắp: kẻ tấn công dùng lại token cũ, người dùng thật cũng mất phiên);
	 * - tài khoản không còn `active` ⇒ `403` (E1-T5: khoá tài khoản phải có hiệu lực ngay cả khi
	 *   refresh token còn hạn).
	 */
	async rotate(
		rawToken: string,
		session: SessionContext = {},
	): Promise<{ pair: TokenPair; user: User }> {
		const payload = await this.verifyRefreshToken(rawToken);

		const existing = await this.refreshTokens.findOne({
			where: { tokenHash: this.hashToken(rawToken) },
		});

		if (!existing) throw new UnauthorizedException(AUTH_MESSAGE.invalidSession);

		if (existing.revokedAt) {
			// Chỉ coi là "dùng lại token bị đánh cắp" khi token bị thu hồi vì **đã được xoay**
			// (`rotated`): kẻ tấn công phát lại token cũ trong khi client thật đã nhận token mới.
			//
			// Với các lý do thu hồi khác (`logout`, `admin_revoke`, `password_*`) thì chỉ trả 401:
			// đó là hành động hợp lệ của chính người dùng hoặc của admin, và client cũ còn giữ token
			// trong bộ nhớ là chuyện bình thường — thu hồi mọi phiên ở đây sẽ đăng xuất toàn bộ thiết
			// bị ngoài ý muốn (đã gặp khi kiểm thử E1-T2: logout một phiên làm chết phiên còn lại).
			if (existing.revokedReason === 'rotated') {
				await this.revokeAllForUser(existing.userId, 'reuse_detected');
			}
			throw new UnauthorizedException(AUTH_MESSAGE.invalidSession);
		}

		if (existing.expiresAt.getTime() <= Date.now()) {
			// Không đánh dấu thu hồi: dòng đã hết hạn sẽ được job dọn dẹp xoá (database-design §10);
			// ghi thêm `revoked_reason` ở đây sẽ làm nhiễu thống kê "vì sao token bị thu hồi".
			throw new UnauthorizedException(AUTH_MESSAGE.invalidSession);
		}

		const user = await this.users.findOne({ where: { id: payload.sub } });
		if (!user || user.deletedAt) {
			throw new UnauthorizedException(AUTH_MESSAGE.invalidSession);
		}
		assertAccountUsable(user);

		const access = await this.signAccessToken(user);
		const next = await this.createRefreshSession(
			user,
			existing.familyId,
			session,
		);

		await this.refreshTokens.update(
			{ id: existing.id },
			{
				revokedAt: new Date(),
				revokedReason: 'rotated',
				replacedByTokenId: next.row.id,
			},
		);

		return {
			pair: this.toTokenPair(access.token, access.expiresIn, next.token),
			user,
		};
	}

	/**
	 * Thu hồi **một phiên** của đúng người dùng đang gọi (`logout` có gửi kèm refresh token).
	 *
	 * Trả về `false` khi không tìm thấy dòng nào thuộc người dùng này — tầng gọi dùng kết quả đó để
	 * quyết định có thu hồi toàn bộ phiên hay không (client gửi token rác thì không được coi là
	 * "đã đăng xuất"). Token **đã** thu hồi vẫn trả `true`: logout phải idempotent, nếu không người
	 * dùng gọi hai lần sẽ bị đăng xuất khỏi mọi thiết bị ngoài ý muốn.
	 */
	async revokeSession(
		rawToken: string,
		userId: string,
		reason: RefreshTokenRevokedReason,
	): Promise<boolean> {
		const existing = await this.refreshTokens.findOne({
			where: { tokenHash: this.hashToken(rawToken), userId },
		});

		if (!existing) return false;

		if (!existing.revokedAt) {
			await this.refreshTokens.update(
				{ id: existing.id },
				{ revokedAt: new Date(), revokedReason: reason },
			);
		}

		return true;
	}

	/** Thu hồi mọi phiên còn hiệu lực của người dùng (logout không kèm token, khoá tài khoản, đổi mật khẩu). */
	async revokeAllForUser(
		userId: string,
		reason: RefreshTokenRevokedReason,
	): Promise<number> {
		const result = await this.refreshTokens.update(
			{ userId, revokedAt: IsNull() },
			{ revokedAt: new Date(), revokedReason: reason },
		);

		return result.affected ?? 0;
	}
}
