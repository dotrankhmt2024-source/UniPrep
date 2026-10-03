/**
 * Union type cho analytics & pipeline rủi ro — xem
 * `docs/02-specs/database-design.md` §7.5, §7.10.
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export type FeatureDirection = 'increases_risk' | 'decreases_risk';

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
	low: 'Thấp',
	medium: 'Trung bình',
	high: 'Cao',
};

export const FEATURE_DIRECTION_LABEL: Record<FeatureDirection, string> = {
	increases_risk: 'Làm tăng nguy cơ',
	decreases_risk: 'Làm giảm nguy cơ',
};
