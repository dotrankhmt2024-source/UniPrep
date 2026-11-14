import { queryMethod } from '@/config';
import type {
	CourseDashboard,
	CourseRisks,
	DefaultResponseType,
	InterventionAction,
	InterventionDraft,
	LearnerDetail,
	RiskModelInfo,
	RiskRunSummary,
} from '@/types';

/** Lần đầu mở dashboard có thể phải chạy dự đoán (ASP) trước khi đọc — cho chờ lâu hơn mặc định. */
const SLOW_TIMEOUT_MS = 60_000;

export interface AnalyticsParams {
	cohortId?: string;
	weeks?: number;
	capacity?: number;
}

type Res<T> = Promise<DefaultResponseType<T>>;

export const getCourseDashboard = (
	courseId: string,
	params: AnalyticsParams = {},
): Res<CourseDashboard> =>
	queryMethod.get(`/analytics/courses/${courseId}/dashboard`, {
		params,
		timeout: SLOW_TIMEOUT_MS,
	}) as Res<CourseDashboard>;

export const getCourseRisks = (
	courseId: string,
	params: AnalyticsParams = {},
): Res<CourseRisks> =>
	queryMethod.get(`/analytics/courses/${courseId}/risks`, {
		params,
		timeout: SLOW_TIMEOUT_MS,
	}) as Res<CourseRisks>;

export const runRiskPrediction = (courseId: string): Res<RiskRunSummary> =>
	queryMethod.post(`/analytics/courses/${courseId}/risks/run`, undefined, {
		timeout: SLOW_TIMEOUT_MS,
	}) as Res<RiskRunSummary>;

export const getLearnerDetail = (
	courseId: string,
	userId: string,
	weeks = 10,
): Res<LearnerDetail> =>
	queryMethod.get(`/analytics/courses/${courseId}/students/${userId}`, {
		params: { weeks },
	}) as Res<LearnerDetail>;

export const draftIntervention = (
	courseId: string,
	payload: { userId: string; type: InterventionAction },
): Res<InterventionDraft> =>
	queryMethod.post(
		`/analytics/courses/${courseId}/interventions/draft`,
		payload,
		{ timeout: SLOW_TIMEOUT_MS },
	) as Res<InterventionDraft>;

export const sendIntervention = (
	courseId: string,
	payload: {
		userId: string;
		type: InterventionAction;
		title: string;
		content: string;
		recommendedLessonIds?: string[];
	},
): Res<{ id: string; status: string; sentAt: string }> =>
	queryMethod.post(
		`/analytics/courses/${courseId}/interventions`,
		payload,
	) as Res<{ id: string; status: string; sentAt: string }>;

export const getRiskModelInfo = (): Res<RiskModelInfo> =>
	queryMethod.get('/analytics/risk-model') as Res<RiskModelInfo>;
