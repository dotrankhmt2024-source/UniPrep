import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsIn,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	MinLength,
} from 'class-validator';
import type {
	InterventionType,
	NotificationChannel,
	RiskLevel,
} from '../../common/types';

export const INTERVENTION_CHANNEL_VALUES = [
	'in_app',
	'email',
	'websocket',
] as const satisfies readonly NotificationChannel[];

export const INTERVENTION_TYPE_VALUES = [
	'in_app_message',
	'email_reminder',
	'recommended_lesson',
	'mentor_assignment',
	'manual_note',
] as const satisfies readonly InterventionType[];

/**
 * Body gửi lên khi Giảng viên:
 * "Nhập prompt và chọn nhóm học viên -> bấm Kiểm tra"
 */
export class RunPromptInterventionDto {
	@ApiProperty({
		description: 'ID khoá học mà giảng viên đang thực hiện kiểm tra & cảnh báo',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID('4', { message: 'courseId phải là UUID hợp lệ' })
	courseId!: string;

	@ApiProperty({
		description:
			'Prompt yêu cầu của giảng viên (ví dụ: "Kiểm tra các bạn trễ bài tập hoặc tiến độ dưới 50% và gửi nhắc nhở ôn tập")',
		example:
			'Kiểm tra những học viên có tiến độ dưới 50% hoặc nộp muộn bài kiểm tra để nhắc nhở học bù trong tuần này.',
	})
	@IsString()
	@IsNotEmpty({ message: 'Prompt không được để trống' })
	@MinLength(10, {
		message: 'Prompt quá ngắn, vui lòng mô tả rõ ý định và tiêu chí kiểm tra',
	})
	@MaxLength(2000, { message: 'Prompt không được vượt quá 2000 ký tự' })
	prompt!: string;

	@ApiPropertyOptional({
		description:
			'ID lớp/nhóm học viên (Cohort). Nếu truyền vào sẽ lọc học viên thuộc lớp này.',
		example: '660e8400-e29b-41d4-a716-446655440001',
	})
	@IsOptional()
	@IsUUID('4', { message: 'cohortId phải là UUID hợp lệ' })
	cohortId?: string;

	@ApiPropertyOptional({
		description:
			'Danh sách ID học viên cụ thể được chọn (nếu giảng viên tick chọn từng người hoặc một nhóm nhỏ). Nếu để trống cả cohortId và studentIds sẽ kiểm tra toàn bộ học viên active của khoá.',
		type: [String],
	})
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(200)
	@IsUUID('4', { each: true, message: 'Mỗi studentId phải là UUID hợp lệ' })
	studentIds?: string[];

	@ApiPropertyOptional({
		description: 'Kênh gửi thông báo (mặc định: in_app)',
		enum: INTERVENTION_CHANNEL_VALUES,
		default: 'in_app',
	})
	@IsOptional()
	@IsIn(INTERVENTION_CHANNEL_VALUES)
	channel?: NotificationChannel;

	@ApiPropertyOptional({
		description: 'Loại can thiệp (mặc định: in_app_message)',
		enum: INTERVENTION_TYPE_VALUES,
		default: 'in_app_message',
	})
	@IsOptional()
	@IsIn(INTERVENTION_TYPE_VALUES)
	interventionType?: InterventionType;

	@ApiPropertyOptional({
		description:
			'Chế độ chạy thử (dryRun = true thì chỉ chạy tới bước soạn & kiểm chứng nội dung chứ chưa lưu thông báo thật; mặc định false là gửi thật theo đúng sơ đồ)',
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	dryRun?: boolean;
}

/**
 * Cấu trúc dữ kiện học tập (Context) do MCP thu thập cho từng học viên
 */
export interface StudentLearningContext {
	userId: string;
	fullName: string;
	email: string;
	studentCode: string | null;
	enrollmentId: string;
	cohortId: string | null;
	cohortName: string | null;
	progressPercent: number;
	completedLessonsCount: number;
	totalPublishedLessonsCount: number;
	overdueLessonsCount: number;
	incompleteLessonTitles: string[];
	recommendedLessonIds: string[];
	submittedQuizzesCount: number;
	totalPublishedQuizzesCount: number;
	lateSubmissionsCount: number;
	averageQuizScorePercent: number | null;
	daysSinceLastActivity: number | null;
	recentEventsCount7d: number;
	latestRiskPrediction: {
		id: string;
		riskScore: number;
		riskLevel: RiskLevel;
		isAtRisk: boolean;
		explanationSummary: string | null;
	} | null;
}

/**
 * Kết quả xử lý trên từng học viên để trả về ở bước "Báo kết quả cho giảng viên"
 */
export type StudentInterventionDecisionStatus =
	| 'sent' // Đã gửi push notification thành công
	| 'skipped_by_asp' // ASP quyết định không cần gửi push (kèm lý do)
	| 'blocked_ungrounded'; // Chặn gửi vì nội dung LLM không bám sát dữ kiện

export interface StudentInterventionItemResult {
	userId: string;
	fullName: string;
	studentCode: string | null;
	status: StudentInterventionDecisionStatus;
	aspReason: string;
	groundingCheckPassed?: boolean;
	groundingIssues?: string[];
	generatedTitle?: string;
	generatedContent?: string;
	interventionId?: string;
	notificationId?: string;
	contextSummary: {
		progressPercent: number;
		overdueLessonsCount: number;
		lateSubmissionsCount: number;
		averageQuizScorePercent: number | null;
		daysSinceLastActivity: number | null;
		riskLevel: RiskLevel | null;
	};
}

/**
 * Kết quả tổng thể trả về cho Giảng viên sau khi bấm Kiểm tra
 */
export interface RunPromptInterventionResponse {
	isPromptClear: boolean;
	clarificationRequest?: string;
	parsedIntent?: {
		intentSummary: string;
		targetCriteria: string[];
		thresholds: {
			maxProgressPercent?: number;
			minInactiveDays?: number;
			maxQuizScorePercent?: number;
			checkOverdueOrLate?: boolean;
			onlyAtRisk?: boolean;
		};
	};
	summary: {
		totalEvaluated: number;
		sentCount: number;
		skippedCount: number;
		blockedCount: number;
	};
	results: StudentInterventionItemResult[];
}