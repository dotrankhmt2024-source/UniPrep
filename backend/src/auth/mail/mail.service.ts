import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Gửi email giao dịch (hiện chỉ có email đặt lại mật khẩu — E1-T4).
 *
 * Vì sao chưa dùng SMTP thật: module email là hạng mục của giai đoạn sau (§5.2 ghi rõ "chưa có
 * module email — giai đoạn đầu ghi log token ở môi trường dev"). Ở đây tách thành service riêng
 * để khi thay bằng Nodemailer/MailHog thì `AuthService` không phải sửa: chỉ thay phần thân.
 *
 * Ở `production` **không** ghi token ra log (log production thường được thu thập tập trung) mà chỉ
 * cảnh báo rằng kênh gửi email chưa được cấu hình — token vẫn không rò rỉ.
 */
@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);

	constructor(private readonly configService: ConfigService) {}

	/**
	 * Vì sao **không** `async`: bản dev chỉ ghi log (không có I/O bất đồng bộ) nên `async` sẽ bị
	 * ESLint bắt lỗi `require-await`. Giữ chữ ký trả `Promise<void>` để lúc thay bằng SMTP thật
	 * (`await transporter.sendMail(...)`) tầng gọi `AuthService` không phải sửa gì.
	 */
	sendPasswordResetToken(
		email: string,
		token: string,
		expiresAt: Date,
	): Promise<void> {
		const isProduction =
			this.configService.get<string>('NODE_ENV') === 'production';

		if (isProduction) {
			this.logger.warn(
				`Chưa cấu hình kênh email: bỏ qua email đặt lại mật khẩu cho ${email}.`,
			);
			return Promise.resolve();
		}

		this.logger.log(
			`[DEV] Email đặt lại mật khẩu cho ${email} — mở /reset-password?token=${token} (hết hạn lúc ${expiresAt.toISOString()})`,
		);

		return Promise.resolve();
	}
}
