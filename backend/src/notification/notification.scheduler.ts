import {
	Injectable,
	Logger,
	OnApplicationBootstrap,
	OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';

/**
 * Job định kỳ nhắc hạn nộp (`deadline_reminder`).
 *
 * Dùng `setInterval` thay vì `@nestjs/schedule` để không thêm phụ thuộc cho một job duy nhất. Chạy
 * nhiều instance cùng lúc vẫn an toàn vì `sendDeadlineReminders` idempotent theo (học viên, đối tượng).
 *
 * Biến môi trường:
 * - `NOTIFICATION_SCHEDULER_ENABLED` (mặc định `true`; luôn tắt khi `NODE_ENV=test`)
 * - `NOTIFICATION_REMINDER_INTERVAL_MINUTES` (mặc định 30)
 * - `NOTIFICATION_REMINDER_WITHIN_HOURS` (mặc định 24): nhắc bài sắp hết hạn trong ngần này giờ.
 */
@Injectable()
export class NotificationScheduler
	implements OnApplicationBootstrap, OnModuleDestroy
{
	private readonly logger = new Logger(NotificationScheduler.name);
	private timer: NodeJS.Timeout | null = null;
	private running = false;

	constructor(
		private readonly notifications: NotificationService,
		private readonly config: ConfigService,
	) {}

	onApplicationBootstrap(): void {
		const enabled =
			this.config.get<string>('NOTIFICATION_SCHEDULER_ENABLED') !== 'false' &&
			this.config.get<string>('NODE_ENV') !== 'test';
		if (!enabled) return;
		const minutes = this.positive('NOTIFICATION_REMINDER_INTERVAL_MINUTES', 30);
		this.timer = setInterval(() => void this.tick(), minutes * 60_000);
		// Không giữ tiến trình sống chỉ vì job này (CLI, script, test).
		this.timer.unref();
		// Chạy lần đầu ngay sau khi khởi động để không phải chờ hết một chu kỳ.
		setTimeout(() => void this.tick(), 10_000).unref();
		this.logger.log(`Job nhắc hạn chạy mỗi ${minutes} phút.`);
	}

	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	async tick(): Promise<void> {
		if (this.running) return;
		this.running = true;
		try {
			const hours = this.positive('NOTIFICATION_REMINDER_WITHIN_HOURS', 24);
			const sent = await this.notifications.sendDeadlineReminders(hours);
			if (sent) this.logger.log(`Đã gửi ${sent} thông báo nhắc hạn.`);
		} catch (error) {
			this.logger.error(
				`Job nhắc hạn lỗi: ${(error as Error).message}`,
				(error as Error).stack,
			);
		} finally {
			this.running = false;
		}
	}

	private positive(key: string, fallback: number): number {
		const value = Number(this.config.get<string>(key));
		return Number.isFinite(value) && value > 0 ? value : fallback;
	}
}
