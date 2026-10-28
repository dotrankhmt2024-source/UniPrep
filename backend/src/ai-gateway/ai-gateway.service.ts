import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StudentLearningContext } from '../intervention/dto/run-prompt-intervention.dto';

@Injectable()
export class AiGatewayService {
	private readonly logger = new Logger(AiGatewayService.name);
	private readonly aiServiceUrl: string;
	private readonly apiKey: string;

	constructor(private readonly configService: ConfigService) {
		this.aiServiceUrl =
			this.configService.get<string>('AI_SERVICE_URL') ?? 'http://127.0.0.1:8000';
		this.apiKey = this.configService.get<string>('AI_SERVICE_API_KEY') ?? '';
	}

	/**
	 * Gọi LLM / AI service để soạn nội dung thông báo riêng cho từng sinh viên dựa trên context đã kiểm chứng
	 */
	async draftInterventionMessage(
		instructorPrompt: string,
		context: StudentLearningContext,
	): Promise<{ title: string; content: string }> {
		try {
			// Thử gọi FastAPI AI Service bên ngoài nếu có cấu hình
			const response = await fetch(
				`${this.aiServiceUrl}/api/v1/generate-intervention`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
					},
					body: JSON.stringify({
						prompt: instructorPrompt,
						student_context: context,
					}),
					signal: AbortSignal.timeout(10000), // Timeout 10s tránh treo luồng khi service ngoài tắt
				},
			);

			if (response.ok) {
				const data = (await response.json()) as {
					title?: string;
					content?: string;
				};
				if (data.title && data.content) {
					return { title: data.title, content: data.content };
				}
			}
		} catch (error) {
			this.logger.warn(
				`Không gọi được AI service ngoài, hệ thống tự động dùng Fallback template nội bộ: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}

		// Fallback thông minh dựa trên context thực tế của sinh viên (giúp demo/test luôn chạy mượt mà 100%)
		return this.generateFallbackMessage(instructorPrompt, context);
	}

	private generateFallbackMessage(
		prompt: string,
		context: StudentLearningContext,
	): { title: string; content: string } {
		const title = `[UniPrep] Nhắc nhở học tập & Cải thiện tiến độ`;
		let issuesText = '';

		if (context.progressPercent < 50) {
			issuesText += `- Tiến độ học tập hiện tại của bạn là ${context.progressPercent}%, đang thấp hơn mức kỳ vọng.\n`;
		}
		if (context.overdueLessonsCount > 0) {
			issuesText += `- Bạn đang có ${context.overdueLessonsCount} bài học/nội dung đã quá hạn.\n`;
		}
		if (
			context.daysSinceLastActivity !== null &&
			context.daysSinceLastActivity >= 3
		) {
			issuesText += `- Bạn đã vắng mặt trên hệ thống trong ${context.daysSinceLastActivity} ngày qua.\n`;
		}

		if (!issuesText) {
			issuesText = `- Tiến độ học tập hiện tại: ${context.progressPercent}%.\n`;
		}

		const content = `Chào ${context.fullName},\n\nGiảng viên vừa chạy hệ thống phân tích và nhận thấy tình hình học tập của bạn cần được chú ý:\n${issuesText}\nYêu cầu từ giảng viên: "${prompt}"\n\nVui lòng truy cập lại nền tảng UniPrep để hoàn thành các nội dung còn thiếu nhé! Chúc bạn học tập tốt.`;

		return { title, content };
	}
}