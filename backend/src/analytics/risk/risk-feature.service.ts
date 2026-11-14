import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { RiskFeatures } from './risk-features';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Ngày theo giờ Việt Nam: "học hôm nay" của học viên không bị cắt đôi lúc 7h sáng (UTC 0h). */
const TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface LearnerFeatures {
	enrollmentId: string;
	userId: string;
	fullName: string;
	studentCode: string | null;
	cohortId: string | null;
	totalEvents: number;
	features: RiskFeatures;
}

interface EnrollmentRow {
	enrollment_id: string;
	user_id: string;
	full_name: string;
	student_code: string | null;
	cohort_id: string | null;
}

/**
 * Tính `RiskFeatures` cho mọi ghi danh đang học của một khoá tại thời điểm `now` — **cùng định nghĩa**
 * với bản tính trên OULAD (`oulad/build-oulad-features.ts`), ánh xạ như sau:
 *
 * | OULAD | UniPrep |
 * |---|---|
 * | ngày có click trên VLE (`studentVle.date`) | ngày có `learning_events` |
 * | bài đánh giá có hạn (TMA/CMA, `assessments.date`) | bài học có `due_at` + quiz có `due_at` |
 * | nộp bài (`studentAssessment.date_submitted`) | hoàn thành bài học (`lesson_progress.completed_at`) / nộp quiz (`submissions.submitted_at`) |
 * | điểm bài (`score`, 0–100) | `submissions.score / max_score × 100` (bài đã chấm) |
 */
@Injectable()
export class RiskFeatureService {
	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	async computeForCourse(
		courseId: string,
		now = new Date(),
	): Promise<LearnerFeatures[]> {
		const enrollments: EnrollmentRow[] = await this.dataSource.query(
			`SELECT e.id AS enrollment_id, e.user_id, u.full_name, u.student_code, e.cohort_id
			   FROM enrollments e
			   JOIN users u ON u.id = e.user_id AND u.deleted_at IS NULL
			  WHERE e.course_id = $1 AND e.status = 'active'`,
			[courseId],
		);
		if (!enrollments.length) return [];

		const [
			lastEvents,
			recentDays,
			dueLessons,
			lessonDone,
			dueQuizzes,
			submissions,
		] = await Promise.all([
			this.dataSource.query<
				{ user_id: string; last_at: Date; total: number }[]
			>(
				`SELECT user_id, MAX(occurred_at) AS last_at, COUNT(*)::int AS total
					   FROM learning_events
					  WHERE course_id = $1 AND occurred_at <= $2
					  GROUP BY user_id`,
				[courseId, now],
			),
			this.dataSource.query<{ user_id: string; days_ago: number }[]>(
				`SELECT user_id, ($2::timestamptz AT TIME ZONE '${TIMEZONE}')::date
					        - (occurred_at AT TIME ZONE '${TIMEZONE}')::date AS days_ago
					   FROM learning_events
					  WHERE course_id = $1 AND occurred_at <= $2
					    AND occurred_at > $2::timestamptz - interval '29 days'
					  GROUP BY user_id, days_ago`,
				[courseId, now],
			),
			this.dataSource.query<{ id: string; due_at: Date }[]>(
				`SELECT id, due_at FROM lessons
					  WHERE course_id = $1 AND is_published AND deleted_at IS NULL
					    AND due_at IS NOT NULL AND due_at <= $2`,
				[courseId, now],
			),
			this.dataSource.query<
				{
					user_id: string;
					lesson_id: string;
					completed_at: Date;
					due_at: Date | null;
				}[]
			>(
				`SELECT lp.user_id, lp.lesson_id, lp.completed_at, l.due_at
					   FROM lesson_progress lp
					   JOIN lessons l ON l.id = lp.lesson_id
					  WHERE lp.course_id = $1 AND lp.status = 'completed'
					    AND lp.completed_at IS NOT NULL AND lp.completed_at <= $2`,
				[courseId, now],
			),
			this.dataSource.query<{ id: string; due_at: Date }[]>(
				`SELECT id, due_at FROM quizzes
					  WHERE course_id = $1 AND is_published AND deleted_at IS NULL
					    AND due_at IS NOT NULL AND due_at <= $2`,
				[courseId, now],
			),
			this.dataSource.query<
				{
					user_id: string;
					quiz_id: string;
					submitted_at: Date;
					is_late: boolean;
					status: string;
					score: string | null;
					max_score: string | null;
				}[]
			>(
				`SELECT user_id, quiz_id, submitted_at, is_late, status, score, max_score
					   FROM submissions
					  WHERE course_id = $1 AND submitted_at IS NOT NULL AND submitted_at <= $2
					    AND status IN ('submitted', 'graded')
					  ORDER BY submitted_at ASC`,
				[courseId, now],
			),
		]);

		const daysAgo = (date: Date) =>
			Math.max(
				0,
				Math.floor((now.getTime() - new Date(date).getTime()) / DAY_MS),
			);
		const lastByUser = new Map(lastEvents.map((row) => [row.user_id, row]));
		const daysByUser = new Map<string, number[]>();
		recentDays.forEach((row) => {
			const list = daysByUser.get(row.user_id) ?? [];
			list.push(Number(row.days_ago));
			daysByUser.set(row.user_id, list);
		});
		const groupBy = <T extends { user_id: string }>(rows: T[]) => {
			const map = new Map<string, T[]>();
			rows.forEach((row) =>
				map.set(row.user_id, [...(map.get(row.user_id) ?? []), row]),
			);
			return map;
		};
		const doneByUser = groupBy(lessonDone);
		const subsByUser = groupBy(submissions);

		return enrollments.map((enrollment) => {
			const last = lastByUser.get(enrollment.user_id);
			const days = daysByUser.get(enrollment.user_id) ?? [];
			const done = doneByUser.get(enrollment.user_id) ?? [];
			const subs = subsByUser.get(enrollment.user_id) ?? [];
			const doneLessons = new Set(done.map((row) => row.lesson_id));
			const submittedQuizzes = new Set(subs.map((row) => row.quiz_id));

			const dueTotal = dueLessons.length + dueQuizzes.length;
			const dueMissed =
				dueLessons.filter((lesson) => !doneLessons.has(lesson.id)).length +
				dueQuizzes.filter((quiz) => !submittedQuizzes.has(quiz.id)).length;

			// "Nộp" = hoàn thành bài học có hạn hoặc nộp quiz; đúng hạn/trễ xét theo hạn của chính bài đó.
			const handIns = [
				...done
					.filter((row) => row.due_at !== null)
					.map((row) => ({
						at: new Date(row.completed_at),
						late: new Date(row.completed_at) > new Date(row.due_at as Date),
					})),
				...subs.map((row) => ({
					at: new Date(row.submitted_at),
					late: row.is_late,
				})),
			];
			const lateCount = handIns.filter((item) => item.late).length;
			const lastOnTime = handIns
				.filter((item) => !item.late)
				.reduce<Date | null>(
					(latest, item) => (!latest || item.at > latest ? item.at : latest),
					null,
				);

			const scores = subs
				.filter(
					(row) =>
						row.status === 'graded' &&
						row.score !== null &&
						Number(row.max_score) > 0,
				)
				.map((row) => (Number(row.score) / Number(row.max_score)) * 100);
			const avgScore = scores.length
				? scores.reduce((sum, score) => sum + score, 0) / scores.length
				: null;
			const scoreTrend =
				scores.length >= 2
					? (scores.at(-1) as number) -
						scores.slice(0, -1).reduce((sum, score) => sum + score, 0) /
							(scores.length - 1)
					: null;

			return {
				enrollmentId: enrollment.enrollment_id,
				userId: enrollment.user_id,
				fullName: enrollment.full_name,
				studentCode: enrollment.student_code,
				cohortId: enrollment.cohort_id,
				totalEvents: last?.total ?? 0,
				features: {
					recencyDays: last ? daysAgo(last.last_at) : null,
					activeDays14: days.filter((d) => d < 14).length,
					activeDaysPrev14: days.filter((d) => d >= 14 && d < 28).length,
					dueTotal,
					dueMissed,
					lateCount,
					avgScore,
					scoreTrend,
					daysSinceOnTimeSubmission: lastOnTime ? daysAgo(lastOnTime) : null,
				},
			};
		});
	}
}
