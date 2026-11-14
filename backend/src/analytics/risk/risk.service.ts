import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AlertSetting } from '../../admin/entities/alert-setting.entity';
import { Intervention } from '../../intervention/entities/intervention.entity';
import type { InterventionType, RiskLevel } from '../../common/types';
import { ModelVersion } from '../entities/model-version.entity';
import { RiskPrediction } from '../entities/risk-prediction.entity';
import {
	CALIBRATION,
	RiskEngineService,
	type RiskAssessment,
} from './risk-engine.service';
import {
	RiskFeatureService,
	type LearnerFeatures,
} from './risk-feature.service';
import type { RiskFeatures, RiskSignal } from './risk-features';

const MODEL_NAME = 'risk-asp-oulad';
/** Dự đoán cũ hơn ngần này thì mở dashboard sẽ tự chạy lại. */
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
/** Không đề xuất can thiệp lại cho học viên vừa được can thiệp trong ngần này ngày. */
const RECENT_INTERVENTION_DAYS = 7;

export interface StoredSnapshot {
	calibrationVersion: string;
	features: RiskFeatures;
	signals: RiskSignal[];
	reasons: RiskAssessment['reasons'];
	exceptions: RiskAssessment['exceptions'];
	labelDefinition: string;
}

export interface RiskRunSummary {
	courseId: string;
	modelVersion: string;
	computedAt: Date;
	evaluated: number;
	byLevel: Record<RiskLevel, number>;
	cutoffs: {
		medium: number;
		high: number;
		source: 'course_setting' | 'calibration';
	};
	durationMs: number;
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
	computedAt: Date;
	reasons: RiskAssessment['reasons'];
	exceptions: RiskAssessment['exceptions'];
	features: RiskFeatures;
	lastIntervention: {
		id: string;
		type: string;
		status: string;
		sentAt: Date | null;
	} | null;
	/** Hành động ASP chọn trong giới hạn `capacity`; `null` = không chọn (hết lượt, vừa can thiệp, rủi ro thấp). */
	suggestedAction: InterventionType | null;
}

@Injectable()
export class RiskService {
	private readonly logger = new Logger(RiskService.name);
	private modelVersionId: string | null = null;

	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		@InjectRepository(RiskPrediction)
		private readonly predictions: Repository<RiskPrediction>,
		@InjectRepository(ModelVersion)
		private readonly models: Repository<ModelVersion>,
		@InjectRepository(AlertSetting)
		private readonly alertSettings: Repository<AlertSetting>,
		@InjectRepository(Intervention)
		private readonly interventions: Repository<Intervention>,
		private readonly features: RiskFeatureService,
		private readonly engine: RiskEngineService,
	) {}

	/** Bản ghi `model_versions` của bộ ASP hiện hành — tạo một lần, lần sau dùng lại. */
	async ensureModelVersion(): Promise<string> {
		if (this.modelVersionId) return this.modelVersionId;
		const existing = await this.models.findOne({
			where: { name: MODEL_NAME, version: CALIBRATION.version },
		});
		if (existing) {
			this.modelVersionId = existing.id;
			return existing.id;
		}
		await this.models.update(
			{ name: MODEL_NAME, isActive: true },
			{ isActive: false, retiredAt: new Date() },
		);
		const created = await this.models.save(
			this.models.create({
				name: MODEL_NAME,
				version: CALIBRATION.version,
				algorithm: 'asp-clingo+logistic-aggregation',
				featureList: Object.keys(CALIBRATION.model.weights),
				hyperparams: {
					thresholds: CALIBRATION.thresholds,
					cutoffs: CALIBRATION.cutoffs,
					model: CALIBRATION.model,
				},
				metrics: CALIBRATION.metrics,
				trainingDataRef: `${CALIBRATION.source.dataset} — ${CALIBRATION.source.url}`,
				isActive: true,
				trainedAt: new Date(CALIBRATION.createdAt),
				activatedAt: new Date(),
				notes:
					'Luật ASP (clingo-wasm) + trọng số gộp hiệu chỉnh trên OULAD (CC BY 4.0); không học từ dữ liệu UniPrep. ' +
					'Xem docs/03-architecture/risk-asp-oulad.md.',
			}),
		);
		this.modelVersionId = created.id;
		return created.id;
	}

	/** Ngưỡng điểm: cấu hình riêng của khoá (admin đặt) → nếu không có thì dùng ngưỡng hiệu chỉnh trên OULAD. */
	async cutoffsFor(courseId: string): Promise<RiskRunSummary['cutoffs']> {
		const setting = await this.alertSettings.findOne({
			where: { scope: 'course', courseId, isEnabled: true },
		});
		const medium = Number(setting?.thresholdMedium);
		const high = Number(setting?.thresholdHigh);
		if (
			setting &&
			Number.isFinite(medium) &&
			Number.isFinite(high) &&
			medium < high
		)
			return { medium, high, source: 'course_setting' };
		return { ...CALIBRATION.cutoffs, source: 'calibration' };
	}

	async runForCourse(
		courseId: string,
		triggeredBy: 'manual' | 'schedule' | 'event',
	): Promise<RiskRunSummary> {
		const started = Date.now();
		const modelVersionId = await this.ensureModelVersion();
		const cutoffs = await this.cutoffsFor(courseId);
		const learners = await this.features.computeForCourse(courseId);
		const assessments = await this.engine.assess(
			learners.map((item) => item.features),
			cutoffs,
		);
		const computedAt = new Date();

		await this.dataSource.transaction(async (manager) => {
			await manager.update(
				RiskPrediction,
				{ courseId, modelVersionId, isCurrent: true },
				{ isCurrent: false },
			);
			if (!learners.length) return;
			await manager.save(
				RiskPrediction,
				learners.map((learner, index) =>
					this.toRow(learner, assessments[index], {
						courseId,
						modelVersionId,
						computedAt,
						triggeredBy,
					}),
				),
			);
		});

		const byLevel: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0 };
		assessments.forEach((item) => (byLevel[item.level] += 1));
		this.logger.log(
			`Dự đoán rủi ro khoá ${courseId}: ${learners.length} học viên (${JSON.stringify(byLevel)}) trong ${Date.now() - started} ms`,
		);
		return {
			courseId,
			modelVersion: `${MODEL_NAME}@${CALIBRATION.version}`,
			computedAt,
			evaluated: learners.length,
			byLevel,
			cutoffs,
			durationMs: Date.now() - started,
		};
	}

	private toRow(
		learner: LearnerFeatures,
		assessment: RiskAssessment,
		meta: {
			courseId: string;
			modelVersionId: string;
			computedAt: Date;
			triggeredBy: 'manual' | 'schedule' | 'event';
		},
	): Partial<RiskPrediction> {
		const snapshot: StoredSnapshot = {
			calibrationVersion: CALIBRATION.version,
			features: learner.features,
			signals: assessment.reasons.map((reason) => reason.signal),
			reasons: assessment.reasons,
			exceptions: assessment.exceptions,
			labelDefinition: CALIBRATION.source.label,
		};
		return {
			userId: learner.userId,
			courseId: meta.courseId,
			enrollmentId: learner.enrollmentId,
			modelVersionId: meta.modelVersionId,
			riskScore: Number(assessment.score.toFixed(4)),
			riskLevel: assessment.level,
			isAtRisk: assessment.level !== 'low',
			featureSnapshot: snapshot as unknown as Record<string, unknown>,
			explanationSummary: assessment.reasons.length
				? assessment.reasons
						.slice(0, 3)
						.map((reason) => reason.detail)
						.join('; ')
				: 'Không có tín hiệu rủi ro',
			computedAt: meta.computedAt,
			isCurrent: true,
			triggeredBy: meta.triggeredBy,
		};
	}

	/** Thời điểm dự đoán gần nhất của khoá (theo model hiện hành), `null` nếu chưa chạy. */
	async lastComputedAt(courseId: string): Promise<Date | null> {
		const modelVersionId = await this.ensureModelVersion();
		const latest = await this.predictions.findOne({
			where: { courseId, modelVersionId, isCurrent: true },
			order: { computedAt: 'DESC' },
		});
		return latest?.computedAt ?? null;
	}

	async ensureFresh(courseId: string): Promise<void> {
		const last = await this.lastComputedAt(courseId);
		if (!last || Date.now() - last.getTime() > STALE_AFTER_MS)
			await this.runForCourse(courseId, 'schedule');
	}

	/** Danh sách rủi ro hiện tại (chỉ học viên còn ghi danh active), kèm hành động ASP đề xuất. */
	async currentRisks(
		courseId: string,
		options: { cohortIds: string[] | null; capacity: number },
	): Promise<LearnerRisk[]> {
		const modelVersionId = await this.ensureModelVersion();
		const rows: {
			id: string;
			user_id: string;
			enrollment_id: string | null;
			risk_score: string;
			risk_level: RiskLevel;
			computed_at: Date;
			feature_snapshot: StoredSnapshot;
			full_name: string;
			student_code: string | null;
			cohort_id: string | null;
		}[] = await this.dataSource.query(
			`SELECT rp.id, rp.user_id, rp.enrollment_id, rp.risk_score, rp.risk_level, rp.computed_at,
			        rp.feature_snapshot, u.full_name, u.student_code, e.cohort_id
			   FROM risk_predictions rp
			   JOIN users u ON u.id = rp.user_id
			   JOIN enrollments e ON e.id = rp.enrollment_id AND e.status = 'active'
			  WHERE rp.course_id = $1 AND rp.model_version_id = $2 AND rp.is_current
			    AND ($3::uuid[] IS NULL OR e.cohort_id = ANY($3::uuid[]))
			  ORDER BY rp.risk_score DESC, u.full_name ASC`,
			[courseId, modelVersionId, options.cohortIds],
		);
		if (!rows.length) return [];

		const userIds = rows.map((row) => row.user_id);
		const latestInterventions = await this.interventions.find({
			where: { courseId, userId: In(userIds) },
			order: { createdAt: 'DESC' },
		});
		const lastByUser = new Map<string, Intervention>();
		latestInterventions.forEach((item) => {
			if (!lastByUser.has(item.userId)) lastByUser.set(item.userId, item);
		});
		const recentCutoff =
			Date.now() - RECENT_INTERVENTION_DAYS * 24 * 60 * 60 * 1000;

		const plan = await this.engine.plan(
			rows.map((row) => {
				const last = lastByUser.get(row.user_id);
				return {
					key: row.user_id,
					score: Number(row.risk_score),
					level: row.risk_level,
					signals: row.feature_snapshot.signals ?? [],
					recentlyIntervened:
						!!last &&
						last.status !== 'cancelled' &&
						last.createdAt.getTime() >= recentCutoff,
				};
			}),
			options.capacity,
		);

		return rows.map((row) => {
			const last = lastByUser.get(row.user_id);
			return {
				userId: row.user_id,
				enrollmentId: row.enrollment_id,
				fullName: row.full_name,
				studentCode: row.student_code,
				cohortId: row.cohort_id,
				predictionId: row.id,
				score: Number(row.risk_score),
				level: row.risk_level,
				computedAt: row.computed_at,
				reasons: row.feature_snapshot.reasons ?? [],
				exceptions: row.feature_snapshot.exceptions ?? [],
				features: row.feature_snapshot.features,
				lastIntervention: last
					? {
							id: last.id,
							type: last.interventionType,
							status: last.status,
							sentAt: last.sentAt,
						}
					: null,
				suggestedAction: plan.get(row.user_id) ?? null,
			};
		});
	}

	/** Lịch sử điểm rủi ro của một học viên theo thời gian (mọi lần chạy của model hiện hành). */
	async history(courseId: string, userId: string) {
		const modelVersionId = await this.ensureModelVersion();
		const rows = await this.predictions.find({
			where: { courseId, userId, modelVersionId },
			order: { computedAt: 'ASC' },
			take: 200,
		});
		return rows.map((row) => ({
			id: row.id,
			computedAt: row.computedAt,
			score: row.riskScore,
			level: row.riskLevel,
			isCurrent: row.isCurrent,
			snapshot: row.featureSnapshot as unknown as StoredSnapshot,
		}));
	}

	/**
	 * Khép vòng can thiệp: can thiệp đã gửi từ ≥ 7 ngày mà chưa có `outcome` thì so điểm rủi ro lúc gửi
	 * (dự đoán gắn với can thiệp) với điểm hiện tại — giảm ≥ 0,1 hoặc hạ mức: `improved`; tăng ≥ 0,1
	 * hoặc lên mức: `worsened`; còn lại `no_change`. Chạy lười khi giảng viên mở dashboard.
	 */
	async evaluateOutcomes(courseId: string): Promise<number> {
		const modelVersionId = await this.ensureModelVersion();
		const due = await this.interventions.find({
			where: {
				courseId,
				outcome: IsNull(),
				status: In(['sent', 'acknowledged']),
			},
		});
		const old = due.filter(
			(item) =>
				item.sentAt &&
				Date.now() - item.sentAt.getTime() >=
					RECENT_INTERVENTION_DAYS * 86_400_000,
		);
		if (!old.length) return 0;
		const rank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
		let updated = 0;
		for (const item of old) {
			const before = item.riskPredictionId
				? await this.predictions.findOne({
						where: { id: item.riskPredictionId },
					})
				: null;
			const now = await this.predictions.findOne({
				where: {
					courseId,
					userId: item.userId,
					modelVersionId,
					isCurrent: true,
				},
			});
			if (!before || !now || now.computedAt <= (item.sentAt as Date)) continue;
			const delta = now.riskScore - before.riskScore;
			const outcome =
				delta <= -0.1 || rank[now.riskLevel] < rank[before.riskLevel]
					? 'improved'
					: delta >= 0.1 || rank[now.riskLevel] > rank[before.riskLevel]
						? 'worsened'
						: 'no_change';
			await this.interventions.update(item.id, {
				outcome,
				outcomeNote: `Tự đánh giá: điểm rủi ro ${before.riskScore.toFixed(2)} (${before.riskLevel}) → ${now.riskScore.toFixed(2)} (${now.riskLevel}) sau can thiệp.`,
			});
			updated += 1;
		}
		return updated;
	}
}
