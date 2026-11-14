import { Injectable } from '@nestjs/common';
import calibrationJson from './risk-calibration.json';
import { solve } from './clingo.runner';
import {
	SIGNAL_TEXT,
	type RiskFeatures,
	type RiskSignal,
} from './risk-features';
import { scoreSignals, type RiskCalibration } from './risk-model';
import {
	atomIndex,
	featureFacts,
	parseSignals,
	PLANNING_RULES,
	SIGNAL_RULES,
	thresholdConstants,
} from './risk-rules';
import type { InterventionType, RiskLevel } from '../../common/types';

export const CALIBRATION = calibrationJson as unknown as RiskCalibration;

export interface RiskReason {
	signal: RiskSignal;
	label: string;
	/** Câu giải thích có số liệu thật của học viên. */
	detail: string;
	/** Log-odds cộng vào điểm (trọng số hiệu chỉnh trên OULAD). */
	weight: number;
}

export interface RiskAssessment {
	score: number;
	level: RiskLevel;
	reasons: RiskReason[];
	/** Kết luận bị rút lại nhờ ngoại lệ — hiển thị để giảng viên hiểu vì sao KHÔNG cảnh báo. */
	exceptions: { signal: RiskSignal; reason: string; detail: string }[];
}

export interface PlanInput {
	key: string;
	score: number;
	level: RiskLevel;
	signals: RiskSignal[];
	recentlyIntervened: boolean;
}

const EXCEPTION_TEXT: Record<string, (f: RiskFeatures) => string> = {
	recent_submission: (f) =>
		`Không tính "vắng mặt lâu" vì vừa hoàn thành bài đúng hạn ${f.daysSinceOnTimeSubmission ?? '?'} ngày trước`,
	efficient: () =>
		'Không tính "ít tham gia" vì đã hoàn thành mọi bài đến hạn đúng hạn với điểm tốt',
};

/**
 * Bộ não của cảnh báo sớm: ASP (clingo) suy tín hiệu → gộp điểm bằng trọng số hiệu chỉnh trên OULAD →
 * xếp mức theo ngưỡng điểm. Không có bước nào học từ dữ liệu của chính UniPrep.
 */
@Injectable()
export class RiskEngineService {
	get calibration(): RiskCalibration {
		return CALIBRATION;
	}

	async assess(
		features: RiskFeatures[],
		cutoffs: { medium: number; high: number } = CALIBRATION.cutoffs,
	): Promise<RiskAssessment[]> {
		if (!features.length) return [];
		const program = [
			thresholdConstants(CALIBRATION.thresholds),
			SIGNAL_RULES,
			featureFacts(features),
		].join('\n');
		const answer = await solve(program);
		return parseSignals(answer.atoms, features.length).map((result, index) => {
			const f = features[index];
			const score = scoreSignals(result.signals, CALIBRATION.model);
			const level: RiskLevel =
				score >= cutoffs.high
					? 'high'
					: score >= cutoffs.medium
						? 'medium'
						: 'low';
			const reasons = result.signals
				.map((signal) => ({
					signal,
					label: SIGNAL_TEXT[signal].label,
					detail: SIGNAL_TEXT[signal].explain(f),
					weight: CALIBRATION.model.weights[signal] ?? 0,
				}))
				.sort((a, b) => b.weight - a.weight);
			return {
				score,
				level,
				reasons,
				exceptions: result.exceptions.map((item) => ({
					...item,
					detail: EXCEPTION_TEXT[item.reason]?.(f) ?? item.reason,
				})),
			};
		});
	}

	/**
	 * Chọn hành động can thiệp tối ưu cho các học viên có nguy cơ (mức trung bình/cao) trong giới hạn
	 * `capacity` lượt — bài toán tối ưu có ràng buộc giải bằng clingo (`PLANNING_RULES`).
	 */
	async plan(
		learners: PlanInput[],
		capacity: number,
	): Promise<Map<string, InterventionType>> {
		const atRisk = learners.filter((item) => item.level !== 'low');
		if (!atRisk.length) return new Map();
		const facts: string[] = [`capacity(${Math.max(0, Math.floor(capacity))}).`];
		atRisk.forEach((item, index) => {
			facts.push(
				`risk(s${index},${Math.round(item.score * 100)},${item.level === 'high' ? 2 : 1}).`,
			);
			item.signals.forEach((signal) =>
				facts.push(`signal(s${index},${signal}).`),
			);
			if (item.recentlyIntervened)
				facts.push(`recent_intervention(s${index}).`);
		});
		const answer = await solve([PLANNING_RULES, facts.join('\n')].join('\n'), [
			'--opt-mode=opt',
		]);
		const plan = new Map<string, InterventionType>();
		for (const value of answer.atoms) {
			const match = value.match(/^plan\((\w+),(\w+)\)$/);
			const index = match ? atomIndex(match[1]) : null;
			if (match && index !== null && atRisk[index])
				plan.set(atRisk[index].key, match[2] as InterventionType);
		}
		return plan;
	}
}
