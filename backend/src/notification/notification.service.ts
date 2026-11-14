import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import type {
	NotificationChannel,
	NotificationType,
	UserRole,
} from '../common/types';

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

/** Nội dung chung khi gửi một thông báo tới nhiều người (mỗi người một dòng). */
export type BulkNotificationParams = Omit<CreateNotificationParams, 'userId'>;

/** Học viên vừa chuyển lên mức rủi ro `high` trong một lần chạy dự đoán. */
export interface RiskEscalation {
	userId: string;
	predictionId: string;
}

export interface SystemBroadcastParams {
	title: string;
	body: string;
	/** Bỏ trống = mọi vai trò. */
	roles?: UserRole[];
	/** Chỉ gửi cho học viên đang học khoá này. */
	courseId?: string;
	/** Gửi đích danh; khi có thì bỏ qua `roles`/`courseId`. */
	userIds?: string[];
	link?: string;
}

/** Không gửi lại cảnh báo rủi ro cho cùng học viên trong cùng khoá trong ngần này ngày. */
const RISK_ALERT_COOLDOWN_DAYS = 3;

/**
 * Chỉ học viên còn học (`active`) của khoá đã công bố và không riêng tư mới nhận thông báo nội dung:
 * đúng quy tắc hiển thị bài học của `LessonService.assertLessonViewable` — không báo "có bài mới" cho
 * người bấm vào lại bị `403`.
 */
const ACTIVE_LEARNERS_SQL = `
	SELECT e.user_id
	  FROM enrollments e
	  JOIN courses c ON c.id = e.course_id
	  JOIN users u ON u.id = e.user_id
	 WHERE e.course_id = $1 AND e.status = 'active'
	   AND c.status = 'published' AND c.visibility <> 'private' AND c.deleted_at IS NULL
	   AND u.deleted_at IS NULL AND u.status = 'active'`;

@Injectable()
export class NotificationService {
	private readonly logger = new Logger(NotificationService.name);

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
		return this.notificationRepo.save(this.toEntity(params));
	}

	/**
	 * Gửi cùng một nội dung tới nhiều người. Có `relatedId` thì **idempotent**: người đã nhận thông báo
	 * cùng loại cho cùng đối tượng sẽ bị bỏ qua — ẩn/hiện lại bài học hay chạy lại job nhắc hạn không
	 * sinh thông báo thứ hai.
	 */
	async sendMany(
		userIds: string[],
		params: BulkNotificationParams,
	): Promise<number> {
		let targets = [...new Set(userIds)];
		if (!targets.length) return 0;
		if (params.relatedId) {
			const existing: { user_id: string }[] =
				await this.notificationRepo.manager.query(
					`SELECT DISTINCT user_id FROM notifications
					  WHERE notification_type = $1 AND related_id = $2 AND user_id = ANY($3::uuid[])`,
					[params.notificationType, params.relatedId, targets],
				);
			const seen = new Set(existing.map((row) => row.user_id));
			targets = targets.filter((id) => !seen.has(id));
		}
		if (!targets.length) return 0;
		await this.notificationRepo.save(
			targets.map((userId) => this.toEntity({ ...params, userId })),
			{ chunk: 200 },
		);
		return targets.length;
	}

	/**
	 * Thông báo là hiệu ứng phụ: lỗi gửi thông báo **không** được làm hỏng thao tác chính (công bố bài,
	 * chấm điểm, chạy dự đoán). Bọc lời gọi ở đây để mọi nơi gọi xử lý giống nhau.
	 */
	async safely(label: string, task: () => Promise<unknown>): Promise<void> {
		try {
			await task();
		} catch (error) {
			this.logger.error(
				`Gửi thông báo thất bại (${label}): ${(error as Error).message}`,
				(error as Error).stack,
			);
		}
	}

	// =========================================================================
	// new_content — bài học / bài kiểm tra mới được công bố
	// =========================================================================

	async notifyLessonPublished(lessonId: string): Promise<number> {
		const [lesson]: {
			id: string;
			title: string;
			course_id: string;
			course_title: string;
		}[] = await this.notificationRepo.manager.query(
			`SELECT l.id, l.title, l.course_id, c.title AS course_title
			   FROM lessons l JOIN courses c ON c.id = l.course_id
			  WHERE l.id = $1 AND l.is_published AND l.deleted_at IS NULL`,
			[lessonId],
		);
		if (!lesson) return 0;
		return this.sendMany(await this.activeLearners(lesson.course_id), {
			notificationType: 'new_content',
			title: `Bài học mới: ${lesson.title}`,
			body: `Khoá «${lesson.course_title}» vừa có bài học mới «${lesson.title}». Vào học ngay để không bị chậm tiến độ nhé!`,
			relatedType: 'lesson',
			relatedId: lesson.id,
			payload: {
				courseId: lesson.course_id,
				lessonId: lesson.id,
				link: `/courses/${lesson.course_id}/learn/${lesson.id}`,
			},
		});
	}

	async notifyQuizPublished(quizId: string): Promise<number> {
		const [quiz]: {
			id: string;
			title: string;
			course_id: string;
			course_title: string;
			due_at: Date | null;
		}[] = await this.notificationRepo.manager.query(
			`SELECT q.id, q.title, q.course_id, q.due_at, c.title AS course_title
			   FROM quizzes q JOIN courses c ON c.id = q.course_id
			  WHERE q.id = $1 AND q.is_published AND q.deleted_at IS NULL`,
			[quizId],
		);
		if (!quiz) return 0;
		const due = quiz.due_at ? ` Hạn nộp: ${formatDateTime(quiz.due_at)}.` : '';
		return this.sendMany(await this.activeLearners(quiz.course_id), {
			notificationType: 'new_content',
			title: `Bài tập mới: ${quiz.title}`,
			body: `Khoá «${quiz.course_title}» vừa giao bài «${quiz.title}».${due}`,
			relatedType: 'quiz',
			relatedId: quiz.id,
			payload: {
				courseId: quiz.course_id,
				quizId: quiz.id,
				link: `/quizzes/${quiz.id}`,
			},
		});
	}

	// =========================================================================
	// grade_published — giảng viên chấm/chốt điểm bài nộp
	// =========================================================================

	/**
	 * Gửi mỗi lần giảng viên chốt điểm (kể cả chấm lại) — khác `sendMany`, ở đây điểm có thể đổi nên
	 * học viên cần biết cả lần sửa. Không dùng cho bài trắc nghiệm tự chấm: học viên đã thấy điểm ngay
	 * lúc nộp.
	 */
	async notifyGradePublished(
		submissionId: string,
		isRegrade: boolean,
	): Promise<Notification | null> {
		const [row]: {
			id: string;
			user_id: string;
			quiz_id: string;
			course_id: string;
			score: string | null;
			max_score: string | null;
			quiz_title: string;
			has_feedback: boolean;
		}[] = await this.notificationRepo.manager.query(
			`SELECT s.id, s.user_id, s.quiz_id, s.course_id, s.score, s.max_score,
			        q.title AS quiz_title, (s.feedback IS NOT NULL AND s.feedback <> '') AS has_feedback
			   FROM submissions s JOIN quizzes q ON q.id = s.quiz_id
			  WHERE s.id = $1 AND s.status = 'graded'`,
			[submissionId],
		);
		if (!row) return null;
		const score =
			row.score !== null
				? ` Điểm: ${Number(row.score)}${row.max_score !== null ? `/${Number(row.max_score)}` : ''}.`
				: '';
		const feedback = row.has_feedback
			? ' Giảng viên có để lại nhận xét cho bạn.'
			: '';
		return this.sendNotification({
			userId: row.user_id,
			notificationType: 'grade_published',
			title: isRegrade
				? `Điểm bài «${row.quiz_title}» đã được cập nhật`
				: `Đã có điểm bài «${row.quiz_title}»`,
			body: `Bài nộp «${row.quiz_title}» của bạn đã được chấm.${score}${feedback}`,
			relatedType: 'submission',
			relatedId: row.id,
			payload: {
				courseId: row.course_id,
				quizId: row.quiz_id,
				submissionId: row.id,
				link: `/quizzes/${row.quiz_id}`,
			},
		});
	}

	// =========================================================================
	// risk_alert — học viên vừa chuyển lên mức rủi ro cao (E11-T2)
	// =========================================================================

	/**
	 * Nơi gọi (`RiskService.runForCourse`) chỉ truyền học viên **vừa chuyển** lên `high` (lần trước
	 * chưa ở `high`), nên chạy lại dự đoán khi mức không đổi không sinh thông báo mới. Thêm hai lớp
	 * chống trùng ở đây: một dự đoán chỉ báo một lần (`related_id = prediction_id`) và cùng học viên
	 * trong cùng khoá không bị báo lại trong {@link RISK_ALERT_COOLDOWN_DAYS} ngày (điểm dao động quanh
	 * ngưỡng high ↔ medium).
	 *
	 * Tôn trọng `alert_settings.notify_student` / `notify_instructor` (cấu hình khoá, rồi toàn cục).
	 */
	async notifyRiskEscalations(
		courseId: string,
		escalations: RiskEscalation[],
	): Promise<{ students: number; instructors: number }> {
		if (!escalations.length) return { students: 0, instructors: 0 };
		const manager = this.notificationRepo.manager;
		const [setting]: {
			notify_student: boolean;
			notify_instructor: boolean;
		}[] = await manager.query(
			`SELECT notify_student, notify_instructor FROM alert_settings
			  WHERE is_enabled AND (course_id = $1 OR scope = 'global')
			  ORDER BY (course_id IS NULL) ASC LIMIT 1`,
			[courseId],
		);
		const notifyStudent = setting?.notify_student ?? true;
		const notifyInstructor = setting?.notify_instructor ?? true;
		const [course]: { title: string }[] = await manager.query(
			`SELECT title FROM courses WHERE id = $1`,
			[courseId],
		);
		const courseTitle = course?.title ?? 'khoá học';

		const recent: { user_id: string }[] = await manager.query(
			`SELECT DISTINCT user_id FROM notifications
			  WHERE notification_type = 'risk_alert' AND payload->>'courseId' = $1
			    AND user_id = ANY($2::uuid[])
			    AND (related_id = ANY($3::uuid[]) OR sent_at > now() - make_interval(days => $4))`,
			[
				courseId,
				escalations.map((item) => item.userId),
				escalations.map((item) => item.predictionId),
				RISK_ALERT_COOLDOWN_DAYS,
			],
		);
		const skip = new Set(recent.map((row) => row.user_id));
		const fresh = escalations.filter((item) => !skip.has(item.userId));
		if (!fresh.length) return { students: 0, instructors: 0 };

		let students = 0;
		if (notifyStudent) {
			await this.notificationRepo.save(
				fresh.map((item) =>
					this.toEntity({
						userId: item.userId,
						notificationType: 'risk_alert',
						title: 'Tiến độ học tập của bạn cần được chú ý',
						body:
							`Hệ thống nhận thấy bạn có nguy cơ chậm tiến độ trong khoá «${courseTitle}». ` +
							'Hãy dành thời gian hoàn thành các bài học, bài tập còn dang dở; nếu gặp khó khăn, ' +
							'bạn có thể hỏi trợ lý học tập hoặc liên hệ giảng viên.',
						relatedType: 'risk_prediction',
						relatedId: item.predictionId,
						payload: {
							courseId,
							predictionId: item.predictionId,
							link: `/courses/${courseId}`,
						},
					}),
				),
			);
			students = fresh.length;
		}

		let instructors = 0;
		if (notifyInstructor) {
			const staff: { user_id: string }[] = await manager.query(
				`SELECT owner_id AS user_id FROM courses WHERE id = $1
				 UNION
				 SELECT user_id FROM course_instructors WHERE course_id = $1`,
				[courseId],
			);
			const names: { full_name: string }[] = await manager.query(
				`SELECT full_name FROM users WHERE id = ANY($1::uuid[]) ORDER BY full_name LIMIT 5`,
				[fresh.map((item) => item.userId)],
			);
			const listed = names.map((row) => row.full_name).join(', ');
			const more =
				fresh.length > names.length
					? ` và ${fresh.length - names.length} học viên khác`
					: '';
			// Không đặt `relatedId` (một thông báo tổng hợp cho nhiều dự đoán) ⇒ `sendMany` không lọc trùng;
			// việc chống trùng đã làm ở bước lọc `fresh` phía trên.
			instructors = await this.sendMany(
				staff.map((row) => row.user_id),
				{
					notificationType: 'risk_alert',
					title: `${fresh.length} học viên chuyển lên mức rủi ro cao`,
					body: `Khoá «${courseTitle}»: ${listed}${more} vừa được gắn cờ rủi ro cao. Xem phân tích để quyết định can thiệp.`,
					relatedType: 'risk_prediction',
					payload: {
						courseId,
						predictionIds: fresh.map((item) => item.predictionId),
						link: `/teacher/courses/${courseId}/analytics`,
					},
				},
			);
		}
		return { students, instructors };
	}

	// =========================================================================
	// deadline_reminder — nhắc hạn (gọi định kỳ bởi `NotificationScheduler`)
	// =========================================================================

	/**
	 * Nhắc học viên những bài kiểm tra/bài học **sắp tới hạn** trong `withinHours` giờ tới mà họ chưa
	 * nộp / chưa hoàn thành. Idempotent theo (học viên, đối tượng): chạy lại không nhắc lần hai.
	 */
	async sendDeadlineReminders(withinHours: number): Promise<number> {
		const manager = this.notificationRepo.manager;
		const quizzes: {
			id: string;
			title: string;
			course_id: string;
			due_at: Date;
			user_ids: string[];
		}[] = await manager.query(
			`SELECT q.id, q.title, q.course_id, q.due_at, array_agg(e.user_id) AS user_ids
			   FROM quizzes q
			   JOIN courses c ON c.id = q.course_id
			   JOIN enrollments e ON e.course_id = q.course_id AND e.status = 'active'
			   JOIN users u ON u.id = e.user_id AND u.deleted_at IS NULL AND u.status = 'active'
			  WHERE q.is_published AND q.deleted_at IS NULL
			    AND c.status = 'published' AND c.visibility <> 'private' AND c.deleted_at IS NULL
			    AND q.due_at > now() AND q.due_at <= now() + make_interval(hours => $1)
			    AND NOT EXISTS (
			          SELECT 1 FROM submissions s
			           WHERE s.quiz_id = q.id AND s.user_id = e.user_id
			             AND s.status IN ('submitted', 'graded'))
			  GROUP BY q.id`,
			[withinHours],
		);
		const lessons: {
			id: string;
			title: string;
			course_id: string;
			due_at: Date;
			user_ids: string[];
		}[] = await manager.query(
			`SELECT l.id, l.title, l.course_id, l.due_at, array_agg(e.user_id) AS user_ids
			   FROM lessons l
			   JOIN courses c ON c.id = l.course_id
			   JOIN enrollments e ON e.course_id = l.course_id AND e.status = 'active'
			   JOIN users u ON u.id = e.user_id AND u.deleted_at IS NULL AND u.status = 'active'
			  WHERE l.is_published AND l.deleted_at IS NULL
			    AND c.status = 'published' AND c.visibility <> 'private' AND c.deleted_at IS NULL
			    AND l.due_at > now() AND l.due_at <= now() + make_interval(hours => $1)
			    AND NOT EXISTS (
			          SELECT 1 FROM lesson_progress lp
			           WHERE lp.lesson_id = l.id AND lp.user_id = e.user_id AND lp.status = 'completed')
			  GROUP BY l.id`,
			[withinHours],
		);

		let sent = 0;
		for (const quiz of quizzes) {
			sent += await this.sendMany(quiz.user_ids, {
				notificationType: 'deadline_reminder',
				title: `Sắp hết hạn: ${quiz.title}`,
				body: `Bài «${quiz.title}» sẽ hết hạn nộp lúc ${formatDateTime(quiz.due_at)} (${hoursLeft(quiz.due_at)}). Bạn chưa nộp bài này.`,
				relatedType: 'quiz',
				relatedId: quiz.id,
				payload: {
					courseId: quiz.course_id,
					quizId: quiz.id,
					dueAt: quiz.due_at,
					link: `/quizzes/${quiz.id}`,
				},
			});
		}
		for (const lesson of lessons) {
			sent += await this.sendMany(lesson.user_ids, {
				notificationType: 'deadline_reminder',
				title: `Sắp đến hạn hoàn thành: ${lesson.title}`,
				body: `Bài học «${lesson.title}» cần hoàn thành trước ${formatDateTime(lesson.due_at)} (${hoursLeft(lesson.due_at)}).`,
				relatedType: 'lesson',
				relatedId: lesson.id,
				payload: {
					courseId: lesson.course_id,
					lessonId: lesson.id,
					dueAt: lesson.due_at,
					link: `/courses/${lesson.course_id}/learn/${lesson.id}`,
				},
			});
		}
		return sent;
	}

	// =========================================================================
	// system — admin phát thông báo hệ thống
	// =========================================================================

	async broadcastSystem(params: SystemBroadcastParams): Promise<number> {
		let userIds: string[];
		if (params.userIds?.length) {
			const rows: { id: string }[] = await this.notificationRepo.manager.query(
				`SELECT id FROM users WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
				[params.userIds],
			);
			userIds = rows.map((row) => row.id);
		} else if (params.courseId) {
			userIds = await this.activeLearners(params.courseId);
		} else {
			const rows: { id: string }[] = await this.notificationRepo.manager.query(
				`SELECT id FROM users
				  WHERE deleted_at IS NULL AND status = 'active'
				    AND ($1::varchar[] IS NULL OR role = ANY($1::varchar[]))`,
				[params.roles?.length ? params.roles : null],
			);
			userIds = rows.map((row) => row.id);
		}
		return this.sendMany(userIds, {
			notificationType: 'system',
			title: params.title,
			body: params.body,
			payload: params.link ? { link: params.link } : {},
		});
	}

	// =========================================================================
	// Đọc / đánh dấu đã đọc
	// =========================================================================

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
			const saved = await this.notificationRepo.save(notification);
			if (notification.relatedType === 'intervention' && notification.relatedId)
				await this.acknowledgeIntervention(notification.relatedId, userId);
			return saved;
		}

		return notification;
	}

	/**
	 * Học viên mở thông báo can thiệp ⇒ can thiệp chuyển `acknowledged` (khép vòng cảnh báo sớm: giảng
	 * viên biết học viên đã đọc). Cập nhật thẳng bằng SQL để module thông báo không phụ thuộc module can
	 * thiệp; chỉ chạm can thiệp của chính học viên đó và đang ở trạng thái `sent`.
	 */
	private async acknowledgeIntervention(
		interventionId: string,
		userId: string,
	): Promise<void> {
		await this.notificationRepo.manager.query(
			`UPDATE interventions SET status = 'acknowledged', acknowledged_at = now(), updated_at = now()
			  WHERE id = $1 AND user_id = $2 AND status = 'sent'`,
			[interventionId, userId],
		);
	}

	/**
	 * Đánh dấu tất cả thông báo chưa đọc của người dùng là đã đọc.
	 */
	async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
		// Cùng quy tắc với `markAsRead`: đọc thông báo can thiệp ⇒ can thiệp `acknowledged`.
		await this.notificationRepo.manager.query(
			`UPDATE interventions SET status = 'acknowledged', acknowledged_at = now(), updated_at = now()
			  WHERE user_id = $1 AND status = 'sent'
			    AND id IN (SELECT related_id FROM notifications
			                WHERE user_id = $1 AND is_read = false AND related_type = 'intervention')`,
			[userId],
		);
		const result = await this.notificationRepo
			.createQueryBuilder()
			.update(Notification)
			.set({ isRead: true, readAt: () => 'now()' })
			.where('user_id = :userId AND is_read = false', { userId })
			.execute();

		return { updatedCount: result.affected ?? 0 };
	}

	private async activeLearners(courseId: string): Promise<string[]> {
		const rows: { user_id: string }[] =
			await this.notificationRepo.manager.query(ACTIVE_LEARNERS_SQL, [
				courseId,
			]);
		return rows.map((row) => row.user_id);
	}

	private toEntity(params: CreateNotificationParams): Notification {
		return this.notificationRepo.create({
			userId: params.userId,
			notificationType: params.notificationType,
			channel: params.channel ?? 'in_app',
			title: params.title.slice(0, 255),
			body: params.body,
			payload: params.payload ?? {},
			relatedType: params.relatedType ?? null,
			relatedId: params.relatedId ?? null,
			isRead: false,
		});
	}
}

/** Giờ Việt Nam cố định (server có thể chạy UTC). */
function formatDateTime(value: Date | string): string {
	return new Date(value).toLocaleString('vi-VN', {
		timeZone: 'Asia/Ho_Chi_Minh',
		hour: '2-digit',
		minute: '2-digit',
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	});
}

function hoursLeft(value: Date | string): string {
	const hours = Math.max(
		0,
		Math.round((new Date(value).getTime() - Date.now()) / 3_600_000),
	);
	return hours < 1 ? 'còn chưa đầy 1 giờ' : `còn khoảng ${hours} giờ`;
}
