import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import type { User } from '../../user/entities/user.entity';

/**
 * Chiến lược `local` cho `POST /api/auth/login` (E1-T1).
 *
 * `usernameField: 'email'` vì API dùng email làm định danh (§5.3); mặc định của passport-local là
 * `username`, nếu để mặc định thì request hợp lệ vẫn bị báo thiếu thông tin đăng nhập.
 *
 * Toàn bộ việc kiểm tra mật khẩu/trạng thái/khoá tài khoản nằm trong `AuthService.validateCredentials`
 * — strategy chỉ là lớp chuyển tiếp để luồng đăng nhập đi qua đúng Passport như architecture.md §3.2.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
	constructor(private readonly authService: AuthService) {
		super({ usernameField: 'email' });
	}

	validate(email: string, password: string): Promise<User> {
		return this.authService.validateCredentials(email, password);
	}
}
