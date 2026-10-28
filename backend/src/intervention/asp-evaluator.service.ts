import { Injectable } from '@nestjs/common';
import type { StudentLearningContext } from './dto/run-prompt-intervention.dto';

export interface ParsedPromptIntent {
	isClear: boolean;
	clarificationReason?: string;
	intentSummary: string;
	targetCriteria: {
		maxProgressPercent?: number;
		minInactiveDays?: number;
		minOverdueLessons?: number;
		maxQuizScorePercent?: number;
		onlyAtRisk?: boolean;
	};
}

export interface AspEvaluationResult {
	shouldPush: boolean;
	reason: string;
}

@Injectable()
export class AspEvaluatorService {
	/**
	 * Khối 1: Phân tích prompt của giảng viên và đánh giá "Yêu cầu đủ rõ?"
	 */
	evaluatePromptClarity(prompt: string): ParsedPromptIntent {
		const cleanPrompt = prompt.trim().toLowerCase();

		if (cleanPrompt.length < 10) {
			return {
				isClear: false,
				clarificationReason:
					'Prompt quá ngắn. Vui lòng nêu rõ tiêu chí cần cảnh báo (ví dụ: tiến độ dưới 50%, học viên trễ hạn bài tập, hoặc học viên không hoạt động nhiều ngày).',
				intentSummary: prompt,
				targetCriteria: {},
			};
		}

		// Trích xuất các tiêu chí cơ bản từ prompt bằng từ khóa tiếng Việt / tiếng Anh
		const criteria: ParsedPromptIntent['targetCriteria'] = {};
		let hasValidCriteria = false;

		if (
			cleanPrompt.includes('tiến độ') ||
			cleanPrompt.includes('progress') ||
			cleanPrompt.includes('dưới') ||
			cleanPrompt.includes('%')
		) {
			const percentMatch = cleanPrompt.match(/(\d+)\s*%/);
			criteria.maxProgressPercent = percentMatch ? Number(percentMatch[1]) : 50;
			hasValidCriteria = true;
		}

		if (
			cleanPrompt.includes('trễ') ||
			cleanPrompt.includes('quá hạn') ||
			cleanPrompt.includes('overdue') ||
			cleanPrompt.includes('chậm')
		) {
			criteria.minOverdueLessons = 1;
			hasValidCriteria = true;
		}

		if (
			cleanPrompt.includes('không hoạt động') ||
			cleanPrompt.includes('lâu ngày') ||
			cleanPrompt.includes('inactive')
		) {
			const dayMatch = cleanPrompt.match(/(\d+)\s*ngày/);
			criteria.minInactiveDays = dayMatch ? Number(dayMatch[1]) : 3;
			hasValidCriteria = true;
		}

		if (
			cleanPrompt.includes('rủi ro') ||
			cleanPrompt.includes('nguy cơ') ||
			cleanPrompt.includes('risk')
		) {
			criteria.onlyAtRisk = true;
			hasValidCriteria = true;
		}

		// Nếu prompt chung chung không bắt được tiêu chí nào cụ thể, áp dụng tiêu chí mặc định (tiến độ < 60% hoặc có bài quá hạn)
		if (!hasValidCriteria) {
			criteria.maxProgressPercent = 60;
			criteria.minOverdueLessons = 1;
		}

		return {
			isClear: true,
			intentSummary: prompt,
			targetCriteria: criteria,
		};
	}

	/**
	 * Khối 2: ASP đánh giá context của từng sinh viên xem có thoả mãn điều kiện gửi push hay không
	 */
	evaluateStudent(
		context: StudentLearningContext,
		criteria: ParsedPromptIntent['targetCriteria'],
	): AspEvaluationResult {
		const triggers: string[] = [];

		// Kiểm tra tiêu chí tiến độ thấp
		if (
			criteria.maxProgressPercent !== undefined &&
			context.progressPercent <= criteria.maxProgressPercent
		) {
			triggers.push(`Tiến độ học tập thấp (${context.progressPercent}%)`);
		}

		// Kiểm tra bài tập/học liệu quá hạn
		if (
			criteria.minOverdueLessons !== undefined &&
			context.overdueLessonsCount >= criteria.minOverdueLessons
		) {
			triggers.push(
				`Có ${context.overdueLessonsCount} bài học/nội dung quá hạn`,
			);
		}

		// Kiểm tra số ngày không hoạt động
		if (
			criteria.minInactiveDays !== undefined &&
			context.daysSinceLastActivity !== null &&
			context.daysSinceLastActivity >= criteria.minInactiveDays
		) {
			triggers.push(
				`Không hoạt động trong ${context.daysSinceLastActivity} ngày qua`,
			);
		}

		// Kiểm tra cờ rủi ro từ model
		if (
			criteria.onlyAtRisk &&
			context.latestRiskPrediction &&
			context.latestRiskPrediction.isAtRisk
		) {
			triggers.push(
				`Hệ thống dự báo rủi ro mức: ${context.latestRiskPrediction.riskLevel}`,
			);
		}

		// Nếu không có tiêu chí nào khớp nhưng học viên có bất kỳ dấu hiệu chậm tiến độ nào (tiến độ < 50% hoặc trễ bài)
		if (
			triggers.length === 0 &&
			(context.progressPercent < 50 || context.overdueLessonsCount > 0)
		) {
			triggers.push('Phát hiện dấu hiệu chậm tiến độ chung');
		}

		if (triggers.length > 0) {
			return {
				shouldPush: true,
				reason: `Đạt điều kiện can thiệp: ${triggers.join('; ')}`,
			};
		}

		return {
			shouldPush: false,
			reason: `Không đạt tiêu chí cảnh báo (tiến độ: ${context.progressPercent}%, quá hạn: ${context.overdueLessonsCount} bài)`,
		};
	}

	/**
	 * Khối 3: Kiểm tra nội dung LLM soạn có bám sát dữ kiện thực tế không (Anti-hallucination / Grounding Check)
	 */
	checkGrounding(
		generatedContent: string,
		context: StudentLearningContext,
	): { passed: boolean; issues: string[] } {
		const issues: string[] = [];
		const contentLower = generatedContent.toLowerCase();

		// 1. Kiểm tra nếu nội dung khẳng định hoàn thành hết nhưng tiến độ thực tế còn thấp
		if (
			(contentLower.includes('100%') ||
				contentLower.includes('hoàn thành hết')) &&
			context.progressPercent < 80
		) {
			issues.push(
				`Nội dung thông báo khẳng định hoàn thành nhưng tiến độ thực tế chỉ là ${context.progressPercent}%.`,
			);
		}

		// 2. Nếu trong thông báo có nêu con số % tiến độ, kiểm tra xem có khớp với dữ kiện thật không (sai số cho phép <= 5%)
		const mentionedPercents = [
			...generatedContent.matchAll(/(\d+(?:\.\d+)?)\s*%/g),
		].map((m) => Number(m[1]));
		for (const pct of mentionedPercents) {
			const matchesProgress = Math.abs(pct - context.progressPercent) <= 5;
			const matchesQuizScore =
				context.averageQuizScorePercent !== null &&
				Math.abs(pct - context.averageQuizScorePercent) <= 5;

			// Bỏ qua các mốc phần trăm là tiêu chí nhắc lại từ prompt (như 50%, 60%) nếu đã khớp một trong các chỉ số thật
			if (!matchesProgress && !matchesQuizScore && pct !== 50 && pct !== 60) {
				issues.push(
					`Con số ${pct}% trong thông báo không khớp với dữ kiện thực tế của học viên (tiến độ: ${context.progressPercent}%).`,
				);
			}
		}

		return {
			passed: issues.length === 0,
			issues,
		};
	}
}
