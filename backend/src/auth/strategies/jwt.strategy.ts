import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import type { Algorithm } from 'jsonwebtoken';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { AUTH_MESSAGE } from '../constants/auth-message.constant';
import { assertAccountUsable } from '../account-status.util';
import type {
	AccessTokenPayload,
	AuthUser,
} from '../types/authenticated-user.type';

/**
 * Chiến lược `jwt` cho mọi request đã đăng nhập (E1-T2/E1-T3).
 *
 * Vì sao mỗi request vẫn truy vấn `users` thay vì tin hoàn toàn vào claims: quyền và trạng thái
 * tài khoản có thể đổi **sau khi** token được cấp (admin hạ vai trò hoặc khoá tài khoản). Nếu chỉ
 * đọc `role` từ token thì tài khoản vừa bị khoá vẫn dùng được tới 15 phút. Truy vấn theo PK là
 * index scan nên chi phí chấp nhận được.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
	constructor(
		configService: ConfigService,
		@InjectRepository(User)
		private readonly users: Repository<User>,
	) {
		const secret = configService.get<string>('JWT_SECRET');
		if (!secret) {
			// Fail-fast lúc khởi động: thiếu secret mà vẫn chạy được nghĩa là mọi token đều không
			// kiểm chứng được — lỗi cấu hình phải lộ ra ngay, không phải khi có request đầu tiên.
			throw new Error(
				'Thiếu biến môi trường JWT_SECRET — xem backend/.env.example.',
			);
		}

		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: secret,
			algorithms: [
				(configService.get<string>('JWT_ALGORITHM') as Algorithm) ?? 'HS256',
			],
		});
	}

	async validate(payload: AccessTokenPayload): Promise<AuthUser> {
		if (payload.type !== 'access') {
			throw new UnauthorizedException(AUTH_MESSAGE.invalidSession);
		}

		const user = await this.users.findOne({ where: { id: payload.sub } });
		if (!user || user.deletedAt) {
			throw new UnauthorizedException(AUTH_MESSAGE.invalidSession);
		}

		assertAccountUsable(user);

		return {
			id: user.id,
			email: user.email,
			role: user.role,
			status: user.status,
		};
	}
}
