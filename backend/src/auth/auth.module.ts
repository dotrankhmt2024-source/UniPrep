import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Algorithm } from 'jsonwebtoken';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { MailService } from './mail/mail.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

/**
 * `AuthModule` (E1) — nơi duy nhất biết cách phát hành và thu hồi token.
 *
 * `JwtModule` đăng ký **bất đồng bộ** để đọc `JWT_SECRET` từ `ConfigService` (đúng §14.1, không
 * hard-code và không đọc `process.env` rải rác). TokenService được export để `UserModule` thu hồi
 * phiên khi admin khoá tài khoản.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([User, RefreshToken, PasswordResetToken]),
		PassportModule,
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const secret = configService.get<string>('JWT_SECRET');
				if (!secret) {
					throw new Error(
						'Thiếu biến môi trường JWT_SECRET — xem backend/.env.example.',
					);
				}

				return {
					secret,
					signOptions: {
						algorithm:
							(configService.get<string>('JWT_ALGORITHM') as Algorithm) ??
							'HS256',
					},
				};
			},
		}),
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		TokenService,
		MailService,
		JwtStrategy,
		LocalStrategy,
	],
	exports: [AuthService, TokenService],
})
export class AuthModule {}
