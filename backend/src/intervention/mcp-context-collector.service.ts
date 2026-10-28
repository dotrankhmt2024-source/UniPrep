import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { RiskPrediction } from '../analytics/entities/risk-prediction.entity';
import { Enrollment } from '../course/entities/enrollment.entity';
import { Quiz } from '../exercise/entities/quiz.entity';
import { Submission } from '../exercise/entities/submission.entity';
import { LearningEvent } from '../learning-activity/entities/learning-event.entity';
import { LessonProgress } from '../lesson/entities/lesson-progress.entity';
import { Lesson } from '../lesson/entities/lesson.entity';
import type { StudentLearningContext } from './dto/run-prompt-intervention.dto';

export interface CollectContextOptions {
	courseId: string;
	cohortId?: string;
	studentIds?: string[];
}

/**
 * Khối "MCP thu thập dữ kiện học tập liên quan đến từng học viên"
 * và "Tổng hợp context riêng cho từng học viên".
 *
 * Truy vấn dữ liệu thực từ các bảng nghiệp vụ theo batch (tránh lỗi N+1 query)
 * để tạo snapshot dữ kiện (ground-truth context) phục vụ ASP đánh giá và LLM soạn thông báo.
 */
@Injectable()
export class McpContextCollectorService {
	constructor(
		@InjectRepository(Enrollment)
		private readonly enrollmentRepo: Repository<Enrollment>,
		@InjectRepository(Lesson)
		private readonly lessonRepo: Repository<Lesson>,
		@InjectRepository(LessonProgress)
		private readonly lessonProgressRepo: Repository<LessonProgress>,
		@InjectRepository(Quiz)
		private readonly quizRepo: Repository<Quiz>,
		@InjectRepository(Submission)
		private readonly submissionRepo: Repository<Submission>,
		@InjectRepository(LearningEvent)
		private readonly learningEventRepo: Repository<LearningEvent>,
		@InjectRepository(RiskPrediction)
		private readonly riskPredictionRepo: Repository<RiskPrediction>,
	) {}

	async collectContextsForCourse(
		options: CollectContextOptions,
	): Promise<StudentLearningContext[]> {
		const { courseId, cohortId, studentIds } = options;

		// 1. Lấy danh sách ghi danh (enrollments) đang active của khoá học theo nhóm học viên đã chọn
		const enrollmentQb = this.enrollmentRepo
			.createQueryBuilder('enrollment')
			.innerJoinAndSelect('enrollment.user', 'user')
			.leftJoinAndSelect('enrollment.cohort', 'cohort')
			.where('enrollment.courseId = :courseId', { courseId })
			.andWhere('enrollment.status = :status', { status: 'active' })
			.andWhere('user.deletedAt IS NULL');

		if (cohortId) {
			enrollmentQb.andWhere('enrollment.cohortId = :cohortId', { cohortId });
		}

		if (studentIds && studentIds.length > 0) {
			enrollmentQb.andWhere('enrollment.userId IN (:...studentIds)', {
				studentIds,
			});
		}

		const enrollments = await enrollmentQb.getMany();
		if (enrollments.length === 0) {
			return [];
		}

		const userIds = enrollments.map((e) => e.userId);
		const now = new Date();
		const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

		// 2. Thu thập song song toàn bộ dữ kiện học tập của nhóm học viên này trong khoá học
		const [
			publishedLessons,
			lessonProgressList,
			publishedQuizzes,
			submissions,
			recentEvents,
			currentRiskPredictions,
		] = await Promise.all([
			this.lessonRepo.find({
				where: {
					courseId,
					isPublished: true,
					deletedAt: IsNull(),
				},
				order: { orderIndex: 'ASC' },
			}),
			this.lessonProgressRepo.find({
				where: {
					courseId,
					userId: In(userIds),
				},
			}),
			this.quizRepo.find({
				where: {
					courseId,
					isPublished: true,
					deletedAt: IsNull(),
				},
			}),
			this.submissionRepo.find({
				where: {
					courseId,
					userId: In(userIds),
				},
			}),
			this.learningEventRepo.find({
				where: {
					courseId,
					userId: In(userIds),
					occurredAt: MoreThanOrEqual(sevenDaysAgo),
				},
			}),
			this.riskPredictionRepo.find({
				where: {
					courseId,
					userId: In(userIds),
					isCurrent: true,
				},
				order: { computedAt: 'DESC' },
			}),
		]);

		// 3. Tổng hợp context riêng cho từng học viên
		return enrollments.map((enrollment) => {
			const user = enrollment.user;
			const userProgress = lessonProgressList.filter(
				(lp) => lp.userId === enrollment.userId,
			);
			const completedLessonIds = new Set(
				userProgress
					.filter((lp) => lp.status === 'completed')
					.map((lp) => lp.lessonId),
			);

			const incompleteLessons = publishedLessons.filter(
				(lesson) => !completedLessonIds.has(lesson.id),
			);

			const overdueLessons = incompleteLessons.filter(
				(lesson) => lesson.dueAt !== null && new Date(lesson.dueAt) < now,
			);

			// Tính tiến độ thực tế dựa trên số bài đã hoàn thành (hoặc dùng progressPercent từ enrollment)
			const calculatedProgress =
				publishedLessons.length > 0
					? Math.round(
							(completedLessonIds.size / publishedLessons.length) * 10000,
						) / 100
					: Number(enrollment.progressPercent ?? 0);

			const progressPercent = Math.max(
				calculatedProgress,
				Number(enrollment.progressPercent ?? 0),
			);

			// Xử lý dữ kiện bài kiểm tra (Quizzes & Submissions)
			const userSubmissions = submissions.filter(
				(sub) => sub.userId === enrollment.userId,
			);

			const submittedQuizIds = new Set(
				userSubmissions
					.filter(
						(sub) => sub.status === 'submitted' || sub.status === 'graded',
					)
					.map((sub) => sub.quizId),
			);

			const lateSubmissionsCount = userSubmissions.filter(
				(sub) => sub.isLate,
			).length;

			// Tính điểm trung bình (%) của các bài đã chấm điểm
			const gradedSubmissions = userSubmissions.filter(
				(sub) =>
					sub.status === 'graded' &&
					sub.score !== null &&
					sub.maxScore !== null &&
					Number(sub.maxScore) > 0,
			);

			let averageQuizScorePercent: number | null = null;
			if (gradedSubmissions.length > 0) {
				const totalPercent = gradedSubmissions.reduce(
					(acc, sub) => acc + (Number(sub.score) / Number(sub.maxScore)) * 100,
					0,
				);
				averageQuizScorePercent =
					Math.round((totalPercent / gradedSubmissions.length) * 100) / 100;
			}

			// Xử lý mức độ hoạt động (Recency & Telemetry)
			const userRecentEvents = recentEvents.filter(
				(ev) => ev.userId === enrollment.userId,
			);

			const lastActivityDate =
				enrollment.lastActivityAt ?? user.lastLoginAt ?? enrollment.enrolledAt;
			const daysSinceLastActivity = lastActivityDate
				? Math.max(
						0,
						Math.floor(
							(now.getTime() - new Date(lastActivityDate).getTime()) /
								(1000 * 60 * 60 * 24),
						),
					)
				: null;

			// Dự đoán rủi ro mới nhất (nếu có trong bảng risk_predictions)
			const latestRisk =
				currentRiskPredictions.find((rp) => rp.userId === enrollment.userId) ??
				null;

			return {
				userId: enrollment.userId,
				fullName: user.fullName,
				email: user.email,
				studentCode: user.studentCode,
				enrollmentId: enrollment.id,
				cohortId: enrollment.cohortId,
				cohortName: enrollment.cohort?.name ?? null,
				progressPercent,
				completedLessonsCount: completedLessonIds.size,
				totalPublishedLessonsCount: publishedLessons.length,
				overdueLessonsCount: overdueLessons.length,
				incompleteLessonTitles: incompleteLessons
					.slice(0, 5)
					.map((l) => l.title),
				recommendedLessonIds: incompleteLessons.slice(0, 3).map((l) => l.id),
				submittedQuizzesCount: submittedQuizIds.size,
				totalPublishedQuizzesCount: publishedQuizzes.length,
				lateSubmissionsCount,
				averageQuizScorePercent,
				daysSinceLastActivity,
				recentEventsCount7d: userRecentEvents.length,
				latestRiskPrediction: latestRisk
					? {
							id: latestRisk.id,
							riskScore: Number(latestRisk.riskScore),
							riskLevel: latestRisk.riskLevel,
							isAtRisk: latestRisk.isAtRisk,
							explanationSummary: latestRisk.explanationSummary,
						}
					: null,
			};
		});
	}
}
