import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AuthUser } from '../../auth/types/authenticated-user.type';
import type { InterventionType } from '../../common/types';
import { Intervention } from '../../intervention/entities/intervention.entity';
import { NotificationService } from '../../notification/notification.service';
import { DeepSeekClient } from '../../tutor/deepseek.client';
import { RiskPrediction } from '../entities/risk-prediction.entity';
import type { StoredSnapshot } from './risk.service';

export const ACTION_LABEL: Record<InterventionType, string> = {
	in_app_message: 'Nhắc quay lại học',
	email_reminder: 'Nhắc qua email',
	recommended_lesson: 'Gợi ý bài cần học bù',
	mentor_assignment: 'Giao mentor kèm',
	manual_note: 'Ghi chú thủ công',
};

export interface InterventionDraft {
	userId: string;
	predictionId: string;
	type: InterventionType;
	title: string;
	content: string;
	recommendedLessons: { id: string; title: string }[];
	/** `llm`: DeepSeek soạn và qua kiểm tra số liệu; `template`: mẫu soạn sẵn (LLM lỗi/không khớp số liệu). */
	source: 'llm' | 'template';
	groundingIssues: string[];
}

/** Mọi số trong văn bản (bỏ dấu phân cách hàng nghìn, đổi phẩy thập phân thành chấm). */
const numbersIn = (text: string): number[] =>
	[...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) =>
		Number(match[0].replace(',', '.')),
	);

/**
 * Soạn và gửi can thiệp cho học viên có nguy cơ, dựa trên dự đoán ASP hiện tại.
 *
 * **Grounding:** LLM chỉ nhận các dữ kiện có thật (lý do + số liệu trong `feature_snapshot`, tên bài
 * gợi ý) và backend kiểm tra **mọi con số** trong tin nhắn phải nằm trong tập số được phép. Sai thì
 * cho LLM sửa một lần, vẫn sai thì dùng mẫu soạn sẵn. Giảng viên luôn xem/sửa bản nháp trước khi gửi.
 */
@Injectable()
export class RiskInterventionService {
	private readonly logger = new Logger(RiskInterventionService.name);

	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		@InjectRepository(RiskPrediction)
		private readonly predictions: Repository<RiskPrediction>,
		@InjectRepository(Intervention)
		private readonly interventions: Repository<Intervention>,
		private readonly notifications: NotificationService,
		private readonly deepseek: DeepSeekClient,
	) {}

	private async currentPrediction(courseId: string, userId: string) {
		const prediction = await this.predictions.findOne({
			where: { courseId, userId, isCurrent: true },
			relations: { user: true },
			order: { computedAt: 'DESC' },
		});
		if (!prediction)
			throw new NotFoundException(
				'Học viên chưa có dự đoán rủi ro, hãy chạy dự đoán trước.',
			);
		return prediction;
	}

	/** Bài nên học bù: bài đã quá hạn chưa xong trước, rồi tới các bài kế tiếp chưa xong (tối đa 3). */
	private async recommendedLessons(courseId: string, userId: string) {
		return this.dataSource.query<{ id: string; title: string }[]>(
			`SELECT l.id, l.title
			   FROM lessons l
			   JOIN course_sections s ON s.id = l.section_id
			   LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $2 AND lp.status = 'completed'
			  WHERE l.course_id = $1 AND l.is_published AND l.deleted_at IS NULL AND lp.id IS NULL
			  ORDER BY (l.due_at IS NOT NULL AND l.due_at <= now()) DESC, s.order_index, l.order_index
			  LIMIT 3`,
			[courseId, userId],
		);
	}

	async draft(
		courseId: string,
		userId: string,
		type: InterventionType,
	): Promise<InterventionDraft> {
		const prediction = await this.currentPrediction(courseId, userId);
		const snapshot = prediction.featureSnapshot as unknown as StoredSnapshot;
		const lessons = await this.recommendedLessons(courseId, userId);
		const [course] = await this.dataSource.query<{ title: string }[]>(
			`SELECT title FROM courses WHERE id = $1`,
			[courseId],
		);

		const facts = {
			hoc_vien: prediction.user.fullName,
			khoa_hoc: course?.title,
			hanh_dong: ACTION_LABEL[type],
			ly_do: snapshot.reasons.map((reason) => reason.detail),
			bai_goi_y:
				type === 'recommended_lesson' || type === 'mentor_assignment'
					? lessons.map((l) => l.title)
					: [],
		};
		// Số được phép: số liệu thật của học viên + số xuất hiện trong lý do/tên bài/tên khoá.
		const allowed = new Set<number>([
			...numbersIn(JSON.stringify(facts)),
			...Object.values(snapshot.features)
				.filter((v): v is number => typeof v === 'number')
				.map((v) => Math.round(v)),
			14,
		]);
		const check = (text: string) =>
			numbersIn(text)
				.filter((n) => !allowed.has(n) && !allowed.has(Math.round(n)))
				.map((n) => `Số ${n} không có trong dữ liệu của học viên`);

		const template = this.template(facts, type);
		if (!this.deepseek.isConfigured)
			return {
				userId,
				predictionId: prediction.id,
				type,
				...template,
				recommendedLessons: lessons,
				source: 'template',
				groundingIssues: [],
			};

		const messages = [
			{
				role: 'system' as const,
				content:
					'Bạn là trợ lý của giảng viên, soạn một tin nhắn ngắn (dưới 120 từ), ân cần, không phán xét, gửi tới học viên ' +
					'để giúp họ quay lại nhịp học. CHỈ dùng dữ kiện trong json đầu vào; không thêm con số, ngày tháng hay sự việc ' +
					'nào khác. Không nhắc tới "mô hình", "điểm rủi ro" hay "AI". Trả về json: {"title": "...", "content": "..."}.',
			},
			{ role: 'user' as const, content: JSON.stringify(facts) },
		];
		let issues: string[] = [];
		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				const result = await this.deepseek.chat({
					messages,
					json: true,
					thinking: false,
					maxTokens: 800,
				});
				const parsed = JSON.parse(result.content ?? '{}') as {
					title?: string;
					content?: string;
				};
				const title = parsed.title?.trim().slice(0, 200);
				const content = parsed.content?.trim().slice(0, 2000);
				if (!title || !content) {
					issues = ['LLM không trả về đủ tiêu đề và nội dung'];
					continue;
				}
				issues = check(`${title} ${content}`);
				if (!issues.length)
					return {
						userId,
						predictionId: prediction.id,
						type,
						title,
						content,
						recommendedLessons: lessons,
						source: 'llm',
						groundingIssues: [],
					};
				messages.push({
					role: 'user' as const,
					content: `${issues.join('; ')}. Viết lại, bỏ các số đó, chỉ dùng số có trong json.`,
				});
			} catch (error) {
				this.logger.warn(
					`Soạn tin can thiệp lỗi: ${error instanceof Error ? error.message : String(error)}`,
				);
				issues = ['Không gọi được LLM'];
				break;
			}
		}
		return {
			userId,
			predictionId: prediction.id,
			type,
			...template,
			recommendedLessons: lessons,
			source: 'template',
			groundingIssues: issues,
		};
	}

	private template(
		facts: {
			hoc_vien: string;
			khoa_hoc?: string;
			ly_do: string[];
			bai_goi_y: string[];
		},
		type: InterventionType,
	): { title: string; content: string } {
		const reasons = facts.ly_do.length
			? facts.ly_do.map((r) => `- ${r}`).join('\n')
			: '- Tiến độ cần được chú ý';
		const lessons = facts.bai_goi_y.length
			? `\n\nBạn có thể bắt đầu lại từ:\n${facts.bai_goi_y.map((t) => `- ${t}`).join('\n')}`
			: '';
		const closing =
			type === 'mentor_assignment'
				? 'Giảng viên sẽ sắp xếp một bạn mentor để đồng hành cùng bạn trong vài tuần tới.'
				: 'Nếu gặp khó khăn, bạn cứ nhắn cho giảng viên hoặc hỏi Trợ giảng AI của khoá học nhé.';
		return {
			title: `Cùng quay lại nhịp học ${facts.khoa_hoc ?? ''}`.trim(),
			content: `Chào ${facts.hoc_vien},\n\nGiảng viên nhận thấy gần đây:\n${reasons}${lessons}\n\n${closing}`,
		};
	}

	async send(
		courseId: string,
		actor: AuthUser,
		input: {
			userId: string;
			type: InterventionType;
			title: string;
			content: string;
			recommendedLessonIds?: string[];
		},
	): Promise<Intervention> {
		const prediction = await this.currentPrediction(courseId, input.userId);
		if (!input.title.trim() || !input.content.trim())
			throw new BadRequestException('Tiêu đề và nội dung không được để trống.');
		const saved = await this.interventions.save(
			this.interventions.create({
				courseId,
				userId: input.userId,
				instructorId: actor.id,
				enrollmentId: prediction.enrollmentId,
				riskPredictionId: prediction.id,
				interventionType: input.type,
				channel: 'in_app',
				title: input.title.trim(),
				content: input.content.trim(),
				recommendedLessonIds: input.recommendedLessonIds?.length
					? input.recommendedLessonIds
					: null,
				status: 'sent',
				sentAt: new Date(),
				createdById: actor.id,
			}),
		);
		await this.notifications.sendNotification({
			userId: input.userId,
			notificationType: 'intervention_message',
			channel: 'in_app',
			title: saved.title,
			body: saved.content,
			relatedType: 'intervention',
			relatedId: saved.id,
			payload: {
				courseId,
				interventionId: saved.id,
				recommendedLessonIds: saved.recommendedLessonIds ?? [],
			},
		});
		return saved;
	}
}
