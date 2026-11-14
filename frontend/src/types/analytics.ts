/** Kiểu dữ liệu Learning Analytics & cảnh báo sớm (khớp `backend/src/analytics`). */
import type { RiskLevel } from './intervention';

export type RiskSignal =
	| 'never_active'
	| 'inactive'
	| 'low_engagement'
	| 'declining'
	| 'missed_work'
	| 'late_work'
	| 'low_score'
	| 'score_drop';
export type InterventionAction =
	| 'in_app_message'
	| 'email_reminder'
	| 'recommended_lesson'
	| 'mentor_assignment'
	| 'manual_note';

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
	high: 'Cao',
	medium: 'Trung bình',
	low: 'Thấp',
};

export const INTERVENTION_ACTION_LABEL: Record<InterventionAction, string> = {
	in_app_message: 'Nhắc quay lại học',
	email_reminder: 'Nhắc qua email',
	recommended_lesson: 'Gợi ý bài cần học bù',
	mentor_assignment: 'Giao mentor kèm',
	manual_note: 'Ghi chú thủ công',
};

export interface RiskFeatures {
	recencyDays: number | null;
	activeDays14: number;
	activeDaysPrev14: number;
	dueTotal: number;
	dueMissed: number;
	lateCount: number;
	avgScore: number | null;
	scoreTrend: number | null;
	daysSinceOnTimeSubmission: number | null;
}

export interface RiskReason {
	signal: RiskSignal;
	label: string;
	detail: string;
	weight: number;
}

export interface RiskException {
	signal: RiskSignal;
	reason: string;
	detail: string;
}

export interface LearnerRisk {
	userId: string;
	enrollmentId: string | null;
	fullName: string;
	studentCode: string | null;
	cohortId: string | null;
	predictionId: string;
	score: number;
	level: RiskLevel;
	computedAt: string;
	reasons: RiskReason[];
	exceptions: RiskException[];
	features: RiskFeatures;
	lastIntervention: {
		id: string;
		type: InterventionAction;
		status: string;
		sentAt: string | null;
	} | null;
	suggestedAction: InterventionAction | null;
}

export interface RiskCutoffs {
	medium: number;
	high: number;
	source: 'course_setting' | 'calibration';
}

export interface CourseRisks {
	items: LearnerRisk[];
	cutoffs: RiskCutoffs;
	computedAt: string | null;
	capacity: number;
}

export interface AnalyticsOverview {
	learners: number;
	avgProgressPercent: number;
	activeLearners7d: number;
	avgScorePercent: number | null;
	interventions30d: number;
	risk: { byLevel: Record<RiskLevel, number>; computedAt: string | null };
}

export interface WeeklyPoint {
	weekStart: string;
	activeLearners: number;
	learnerDays: number;
	events: number;
	lessonsCompleted: number;
	submissions: number;
	avgScorePercent: number | null;
	risk: { high: number; medium: number; low: number } | null;
}

export interface LessonFunnelItem {
	lessonId: string;
	order: number;
	title: string;
	dueAt: string | null;
	learners: number;
	started: number;
	completed: number;
}

export interface CourseDashboard {
	cohorts: { id: string; name: string; learners: number }[];
	overview: AnalyticsOverview;
	timeseries: WeeklyPoint[];
	lessons: LessonFunnelItem[];
	outcomes: { type: InterventionAction; outcome: string; n: number }[];
}

export interface LearnerDetail {
	history: {
		id: string;
		computedAt: string;
		score: number;
		level: RiskLevel;
		isCurrent: boolean;
		snapshot: { reasons: RiskReason[]; features: RiskFeatures };
	}[];
	weekly: {
		weekStart: string;
		activeDays: number;
		lessonsCompleted: number;
		avgScorePercent: number | null;
	}[];
	interventions: {
		id: string;
		type: InterventionAction;
		status: string;
		title: string;
		content: string;
		sentAt: string | null;
		acknowledgedAt: string | null;
		outcome: string | null;
		outcomeNote: string | null;
		createdAt: string;
	}[];
}

export interface InterventionDraft {
	userId: string;
	predictionId: string;
	type: InterventionAction;
	title: string;
	content: string;
	recommendedLessons: { id: string; title: string }[];
	source: 'llm' | 'template';
	groundingIssues: string[];
}

export interface RiskRunSummary {
	evaluated: number;
	byLevel: Record<RiskLevel, number>;
	durationMs: number;
	modelVersion: string;
}

export interface RiskModelInfo {
	version: string;
	createdAt: string;
	source: {
		dataset: string;
		url: string;
		license: string;
		trainPresentations: string[];
		testPresentations: string[];
		checkpoints: number[];
		label: string;
	};
	thresholds: Record<string, number>;
	model: { intercept: number; weights: Record<RiskSignal, number> };
	cutoffs: { medium: number; high: number };
	metrics: {
		test?: {
			rows: number;
			auc: number;
			medium: { precision: number; recall: number; f1: number };
			high: { precision: number; recall: number; f1: number };
		};
		baselineLogisticContinuous?: {
			auc: number;
			medium: { precision: number; recall: number; f1: number };
		};
		leadTime?: {
			withdrawnStudents: number;
			flaggedBeforeWithdrawal: number;
			medianDays: number | null;
		};
	};
}
