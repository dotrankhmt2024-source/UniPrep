import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import type { NotificationChannel, NotificationType } from '../common/types';

export interface CreateNotificationParams {
	userId: string;
	notificationType: NotificationType;
	channel?: NotificationChannel;
	title: string;
	body: string;
	payload?: Record<string, unknown>;
	relatedType?: string;
	relatedId?: string;
}

@Injectable()
export class NotificationService {
	constructor(
		@InjectRepository(Notification)
		private readonly notificationRepo: Repository<Notification>,
	) {}

	/**
	 * Tạo và lưu thông báo mới xuống DB (kênh in_app, email hoặc websocket)
	 * để học viên nhận được trên dashboard/ứng dụng.
	 */
	async sendNotification(
		params: CreateNotificationParams,
	): Promise<Notification> {
		const notification = this.notificationRepo.create({
			userId: params.userId,
			notificationType: params.notificationType,
			channel: params.channel ?? 'in_app',
			title: params.title,
			body: params.body,
			payload: params.payload ?? {},
			relatedType: params.relatedType ?? null,
			relatedId: params.relatedId ?? null,
			isRead: false,
		});

		return this.notificationRepo.save(notification);
	}

	/**
	 * Lấy danh sách thông báo của người dùng hiện tại (mới nhất lên đầu)
	 * kèm tổng số thông báo chưa đọc (unreadCount) để hiển thị badge trên chuông.
	 */
	async findMyNotifications(userId: string): Promise<{
		items: Notification[];
		unreadCount: number;
	}> {
		const [items, unreadCount] = await Promise.all([
			this.notificationRepo.find({
				where: { userId },
				order: { sentAt: 'DESC' },
				take: 50,
			}),
			this.notificationRepo.count({
				where: { userId, isRead: false },
			}),
		]);

		return { items, unreadCount };
	}

	/**
	 * Đánh dấu 1 thông báo là đã đọc (chỉ chính chủ mới được phép đánh dấu).
	 */
	async markAsRead(id: string, userId: string): Promise<Notification> {
		const notification = await this.notificationRepo.findOne({
			where: { id, userId },
		});

		if (!notification) {
			throw new NotFoundException('Không tìm thấy thông báo.');
		}

		if (!notification.isRead) {
			notification.isRead = true;
			notification.readAt = new Date();
			return this.notificationRepo.save(notification);
		}

		return notification;
	}

	/**
	 * Đánh dấu tất cả thông báo chưa đọc của người dùng là đã đọc.
	 */
	async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
		const result = await this.notificationRepo
			.createQueryBuilder()
			.update(Notification)
			.set({ isRead: true, readAt: () => 'now()' })
			.where('user_id = :userId AND is_read = false', { userId })
			.execute();

		return { updatedCount: result.affected ?? 0 };
	}
}
