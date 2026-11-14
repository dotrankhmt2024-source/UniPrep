import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CourseAccessService } from '../course/course-access.service';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { RiskLevel } from '../common/types';
import { RiskService } from './risk/risk.service';

const TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface CourseScope {
	courseId: string;
	/** `null` = thấy mọi lớp; mảng = chỉ các lớp được phân công (đồng giảng viên theo lớp). */
	cohortIds: string[] | null;
	/** Các lớp người xem được phép chọn (`null` = mọi lớp), dùng cho bộ lọc lớp trên giao diện. */
	allowedCohortIds: string[] | null;
}

/**
 * Số liệu dashboard Learning Analytics của một khoá học (E8). Mọi truy vấn đều tham số hoá và áp
 * phạm vi lớp của người xem: admin/chủ khoá thấy cả khoá, giảng viên được phân công theo lớp chỉ thấy
 * lớp đó.
 */
@Injectable()
export class AnalyticsService {
	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		private readonly courseAccess: CourseAccessService,
		private readonly risk: RiskService,
	) {}

	async resolveScope(
		courseId: string,
		actor: AuthUser,
		requestedCohortId?: string,
	): Promise<CourseScope> {
		const course = await this.courseAccess.assertCanManage(courseId, actor);
		let allowed: string[] | null = null;
		if (actor.role !== 'admin' && course.ownerId !== actor.id) {
			const rows: { cohort_id: string | null }[] = await this.dataSource.query(
				`SELECT cohort_id FROM course_instructors WHERE course_id = $1 AND user_id = $2`,
				[courseId, actor.id],
			);
			allowed = rows.some((row) => row.cohort_id === null)
				? null
				: rows.map((row) => row.cohort_id as string);
		}
		if (!requestedCohortId)
			return { courseId, cohortIds: allowed, allowedCohortIds: allowed };
		if (allowed && !allowed.includes(requestedCohortId))
			throw new ForbiddenException('Bạn không phụ trách lớp này.');
		return {
			courseId,
			cohortIds: [requestedCohortId],
			allowedCohortIds: allowed,
		};
	}

	async cohorts(scope: CourseScope) {
		return this.dataSource.query<
			{ id: string; name: string; learners: number }[]
		>(
			`SELECT c.id, c.name, COUNT(e.id)::int AS learners
			   FROM cohorts c
			   LEFT JOIN enrollments e ON e.cohort_id = c.id AND e.status = 'active'
			  WHERE c.course_id = $1 AND ($2::uuid[] IS NULL OR c.id = ANY($2::uuid[]))
			  GROUP BY c.id, c.name ORDER BY c.name`,
			[scope.courseId, scope.allowedCohortIds],
		);
	}

	async overview(scope: CourseScope) {
		const params = [scope.courseId, scope.cohortIds];
		const [base] = await this.dataSource.query<
			{
				learners: number;
				avg_progress: number;
				active_7d: number;
				avg_score: number | null;
				interventions_30d: number;
			}[]
		>(
			`WITH learners AS (
			   SELECT e.id, e.user_id, e.progress_percent FROM enrollments e
			    WHERE e.course_id = $1 AND e.status = 'active'
			      AND ($2::uuid[] IS NULL OR e.cohort_id = ANY($2::uuid[]))
			 )
			 SELECT (SELECT COUNT(*)::int FROM learners) AS learners,
			        (SELECT COALESCE(AVG(progress_percent), 0)::float FROM learners) AS avg_progress,
			        (SELECT COUNT(DISTINCT le.user_id)::int FROM learning_events le
			          WHERE le.course_id = $1 AND le.user_id IN (SELECT user_id FROM learners)
			            AND le.occurred_at > now() - interval '7 days') AS active_7d,
			        (SELECT AVG(s.score / NULLIF(s.max_score, 0) * 100)::float FROM submissions s
			          WHERE s.course_id = $1 AND s.status = 'graded'
			            AND s.user_id IN (SELECT user_id FROM learners)) AS avg_score,
			        (SELECT COUNT(*)::int FROM interventions i
			          WHERE i.course_id = $1 AND i.user_id IN (SELECT user_id FROM learners)
			            AND i.created_at > now() - interval '30 days') AS interventions_30d`,
			params,
		);

		const modelVersionId = await this.risk.ensureModelVersion();
		const levels = await this.dataSource.query<
			{ risk_level: RiskLevel; n: number; computed_at: Date }[]
		>(
			`SELECT rp.risk_level, COUNT(*)::int AS n, MAX(rp.computed_at) AS computed_at
			   FROM risk_predictions rp
			   JOIN enrollments e ON e.id = rp.enrollment_id AND e.status = 'active'
			  WHERE rp.course_id = $1 AND rp.is_current AND rp.model_version_id = $3
			    AND ($2::uuid[] IS NULL OR e.cohort_id = ANY($2::uuid[]))
			  GROUP BY rp.risk_level`,
			[...params, modelVersionId],
		);
		const byLevel: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0 };
		levels.forEach((row) => (byLevel[row.risk_level] = row.n));

		return {
			learners: base.learners,
			avgProgressPercent: Math.round(base.avg_progress * 10) / 10,
			activeLearners7d: base.active_7d,
			avgScorePercent:
				base.avg_score === null ? null : Math.round(base.avg_score * 10) / 10,
			interventions30d: base.interventions_30d,
			risk: {
				byLevel,
				computedAt: levels.reduce<Date | null>(
					(latest, row) =>
						!latest || row.computed_at > latest ? row.computed_at : latest,
					null,
				),
			},
		};
	}

	/**
	 * Chuỗi theo tuần (giờ Việt Nam) cho `weeks` tuần gần nhất: học viên hoạt động, số ngày-học, bài
	 * hoàn thành, bài nộp + điểm trung bình, và số học viên ở từng mức rủi ro (lấy dự đoán cuối cùng
	 * của mỗi học viên trong tuần đó).
	 */
	async timeseries(scope: CourseScope, weeks: number) {
		const params = [scope.courseId, scope.cohortIds, weeks];
		const modelVersionId = await this.risk.ensureModelVersion();
		const rows = await this.dataSource.query<
			{
				week: string;
				active_learners: number;
				learner_days: number;
				events: number;
				lessons_completed: number;
				submissions: number;
				avg_score: number | null;
				high: number | null;
				medium: number | null;
				low: number | null;
			}[]
		>(
			`WITH learners AS (
			   SELECT e.user_id FROM enrollments e
			    WHERE e.course_id = $1 AND e.status = 'active'
			      AND ($2::uuid[] IS NULL OR e.cohort_id = ANY($2::uuid[]))
			 ),
			 weeks AS (
			   SELECT generate_series(
			     date_trunc('week', (now() AT TIME ZONE '${TIMEZONE}')) - (($3::int - 1) * interval '1 week'),
			     date_trunc('week', (now() AT TIME ZONE '${TIMEZONE}')),
			     interval '1 week') AS week
			 ),
			 ev AS (
			   SELECT date_trunc('week', le.occurred_at AT TIME ZONE '${TIMEZONE}') AS week,
			          COUNT(DISTINCT le.user_id)::int AS active_learners,
			          COUNT(DISTINCT (le.user_id, (le.occurred_at AT TIME ZONE '${TIMEZONE}')::date))::int AS learner_days,
			          COUNT(*)::int AS events
			     FROM learning_events le
			    WHERE le.course_id = $1 AND le.user_id IN (SELECT user_id FROM learners)
			    GROUP BY 1
			 ),
			 lp AS (
			   SELECT date_trunc('week', completed_at AT TIME ZONE '${TIMEZONE}') AS week, COUNT(*)::int AS completed
			     FROM lesson_progress
			    WHERE course_id = $1 AND status = 'completed' AND completed_at IS NOT NULL
			      AND user_id IN (SELECT user_id FROM learners)
			    GROUP BY 1
			 ),
			 sb AS (
			   SELECT date_trunc('week', submitted_at AT TIME ZONE '${TIMEZONE}') AS week,
			          COUNT(*)::int AS submissions,
			          AVG(CASE WHEN status = 'graded' THEN score / NULLIF(max_score, 0) * 100 END)::float AS avg_score
			     FROM submissions
			    WHERE course_id = $1 AND submitted_at IS NOT NULL AND user_id IN (SELECT user_id FROM learners)
			    GROUP BY 1
			 ),
			 rk AS (
			   SELECT week,
			          COUNT(*) FILTER (WHERE risk_level = 'high')::int AS high,
			          COUNT(*) FILTER (WHERE risk_level = 'medium')::int AS medium,
			          COUNT(*) FILTER (WHERE risk_level = 'low')::int AS low
			     FROM (
			       SELECT DISTINCT ON (rp.user_id, date_trunc('week', rp.computed_at AT TIME ZONE '${TIMEZONE}'))
			              rp.user_id, rp.risk_level,
			              date_trunc('week', rp.computed_at AT TIME ZONE '${TIMEZONE}') AS week
			         FROM risk_predictions rp
			        WHERE rp.course_id = $1 AND rp.model_version_id = $4
			          AND rp.user_id IN (SELECT user_id FROM learners)
			        ORDER BY rp.user_id, date_trunc('week', rp.computed_at AT TIME ZONE '${TIMEZONE}'), rp.computed_at DESC
			     ) latest
			    GROUP BY week
			 )
			 SELECT to_char(w.week, 'YYYY-MM-DD') AS week,
			        COALESCE(ev.active_learners, 0) AS active_learners,
			        COALESCE(ev.learner_days, 0) AS learner_days,
			        COALESCE(ev.events, 0) AS events,
			        COALESCE(lp.completed, 0) AS lessons_completed,
			        COALESCE(sb.submissions, 0) AS submissions,
			        sb.avg_score,
			        rk.high, rk.medium, rk.low
			   FROM weeks w
			   LEFT JOIN ev ON ev.week = w.week
			   LEFT JOIN lp ON lp.week = w.week
			   LEFT JOIN sb ON sb.week = w.week
			   LEFT JOIN rk ON rk.week = w.week
			  ORDER BY w.week`,
			[...params, modelVersionId],
		);
		return rows.map((row) => ({
			weekStart: row.week,
			activeLearners: row.active_learners,
			learnerDays: row.learner_days,
			events: row.events,
			lessonsCompleted: row.lessons_completed,
			submissions: row.submissions,
			avgScorePercent:
				row.avg_score === null ? null : Math.round(row.avg_score * 10) / 10,
			risk:
				row.high === null
					? null
					: { high: row.high, medium: row.medium ?? 0, low: row.low ?? 0 },
		}));
	}

	/** Phễu theo bài học (theo lộ trình): bao nhiêu học viên đã mở / đã hoàn thành từng bài. */
	async lessonFunnel(scope: CourseScope) {
		const rows = await this.dataSource.query<
			{
				id: string;
				title: string;
				due_at: Date | null;
				started: number;
				completed: number;
				learners: number;
			}[]
		>(
			`WITH learners AS (
			   SELECT e.user_id FROM enrollments e
			    WHERE e.course_id = $1 AND e.status = 'active'
			      AND ($2::uuid[] IS NULL OR e.cohort_id = ANY($2::uuid[]))
			 )
			 SELECT l.id, l.title, s.order_index AS section_order, l.order_index, l.due_at,
			        COUNT(lp.id)::int AS started,
			        COUNT(lp.id) FILTER (WHERE lp.status = 'completed')::int AS completed,
			        (SELECT COUNT(*)::int FROM learners) AS learners
			   FROM lessons l
			   JOIN course_sections s ON s.id = l.section_id
			   LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id IN (SELECT user_id FROM learners)
			  WHERE l.course_id = $1 AND l.is_published AND l.deleted_at IS NULL
			  GROUP BY l.id, l.title, s.order_index, l.order_index, l.due_at
			  ORDER BY s.order_index, l.order_index`,
			[scope.courseId, scope.cohortIds],
		);
		return rows.map((row, index) => ({
			lessonId: row.id,
			order: index + 1,
			title: row.title,
			dueAt: row.due_at,
			learners: row.learners,
			started: row.started,
			completed: row.completed,
		}));
	}

	/** Hoạt động theo tuần của một học viên (drill-down). */
	async learnerWeekly(courseId: string, userId: string, weeks: number) {
		return this.dataSource.query<
			{
				weekStart: string;
				activeDays: number;
				lessonsCompleted: number;
				avgScorePercent: number | null;
			}[]
		>(
			`WITH weeks AS (
			   SELECT generate_series(
			     date_trunc('week', (now() AT TIME ZONE '${TIMEZONE}')) - (($3::int - 1) * interval '1 week'),
			     date_trunc('week', (now() AT TIME ZONE '${TIMEZONE}')), interval '1 week') AS week
			 )
			 SELECT to_char(w.week, 'YYYY-MM-DD') AS "weekStart",
			        (SELECT COUNT(DISTINCT (le.occurred_at AT TIME ZONE '${TIMEZONE}')::date)::int FROM learning_events le
			          WHERE le.course_id = $1 AND le.user_id = $2
			            AND date_trunc('week', le.occurred_at AT TIME ZONE '${TIMEZONE}') = w.week) AS "activeDays",
			        (SELECT COUNT(*)::int FROM lesson_progress lp
			          WHERE lp.course_id = $1 AND lp.user_id = $2 AND lp.status = 'completed'
			            AND date_trunc('week', lp.completed_at AT TIME ZONE '${TIMEZONE}') = w.week) AS "lessonsCompleted",
			        (SELECT ROUND(AVG(s.score / NULLIF(s.max_score, 0) * 100)::numeric, 1)::float FROM submissions s
			          WHERE s.course_id = $1 AND s.user_id = $2 AND s.status = 'graded'
			            AND date_trunc('week', s.submitted_at AT TIME ZONE '${TIMEZONE}') = w.week) AS "avgScorePercent"
			   FROM weeks w ORDER BY w.week`,
			[courseId, userId, weeks],
		);
	}

	async interventionsOf(courseId: string, userId: string) {
		return this.dataSource.query<Record<string, unknown>[]>(
			`SELECT id, intervention_type AS "type", status, title, content, sent_at AS "sentAt",
			        acknowledged_at AS "acknowledgedAt", outcome, outcome_note AS "outcomeNote", created_at AS "createdAt"
			   FROM interventions WHERE course_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50`,
			[courseId, userId],
		);
	}

	async interventionOutcomes(scope: CourseScope) {
		return this.dataSource.query<
			{ type: string; outcome: string; n: number }[]
		>(
			`SELECT i.intervention_type AS "type", COALESCE(i.outcome, 'pending') AS outcome, COUNT(*)::int AS n
			   FROM interventions i
			   LEFT JOIN enrollments e ON e.id = i.enrollment_id
			  WHERE i.course_id = $1 AND ($2::uuid[] IS NULL OR e.cohort_id = ANY($2::uuid[]))
			  GROUP BY 1, 2 ORDER BY 1, 2`,
			[scope.courseId, scope.cohortIds],
		);
	}

	/** Một học viên có thuộc phạm vi xem của người gọi không (chống IDOR khi drill-down). */
	async assertLearnerInScope(scope: CourseScope, userId: string) {
		const rows: unknown[] = await this.dataSource.query(
			`SELECT 1 FROM enrollments e
			  WHERE e.course_id = $1 AND e.user_id = $2
			    AND ($3::uuid[] IS NULL OR e.cohort_id = ANY($3::uuid[]))`,
			[scope.courseId, userId, scope.cohortIds],
		);
		if (!rows.length)
			throw new ForbiddenException(
				'Học viên không thuộc phạm vi bạn phụ trách.',
			);
	}
}
