import type { BaseEntity } from './index';

export type NotificationChannel = 'in_app' | 'email' | 'websocket';

export type InterventionType =
	| 'in_app_message'
	| 'email_reminder'
	| 'recommended_lesson'
	| 'mentor_assignment'
	| 'manual_note';

export type RiskLevel = 'low' | 'medium' | 'high';

export type StudentInterventionDecisionStatus =
	| 'sent'
	| 'skipped_by_asp'
	| 'blocked_ungrounded';

export interface RunPromptInterventionPayload {
	courseId: string;
	prompt: string;
	cohortId?: string;
	studentIds?: string[];
	channel?: NotificationChannel;
	interventionType?: InterventionType;
	dryRun?: boolean;
}

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

export interface RunPromptInterventionResponse {
	isPromptClear: boolean;
	clarificationRequest?: string;
	parsedIntent?: {
		intentSummary: string;
		targetCriteria: string[];
		thresholds: {
			maxProgressPercent?: number;
			minInactiveDays?: number;
			minOverdueLessons?: number;
			maxQuizScorePercent?: number;
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

export interface InterventionRecord extends BaseEntity {
	courseId: string;
	userId: string;
	instructorId: string | null;
	interventionType: InterventionType;
	channel: NotificationChannel;
	title: string;
	content: string;
	status: string;
	sentAt: string | null;
	user?: {
		id: string;
		fullName: string;
		email: string;
		studentCode: string | null;
	};
	instructor?: {
		id: string;
		fullName: string;
	} | null;
}

export interface NotificationItem extends BaseEntity {
	userId: string;
	notificationType: string;
	channel: NotificationChannel;
	title: string;
	body: string;
	payload: Record<string, unknown>;
	relatedType: string | null;
	relatedId: string | null;
	isRead: boolean;
	readAt: string | null;
	sentAt: string;
}

export interface MyNotificationsResponse {
	items: NotificationItem[];
	unreadCount: number;
}