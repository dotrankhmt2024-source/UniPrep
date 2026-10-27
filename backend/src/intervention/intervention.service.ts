import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Intervention } from './entities/intervention.entity';
import { Course } from '../course/entities/course.entity';
import { CourseInstructor } from '../course/entities/course-instructor.entity';
import { McpContextCollectorService } from './mcp-context-collector.service';
import { AspEvaluatorService } from './asp-evaluator.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { NotificationService } from '../notification/notification.service';
import type {
	RunPromptInterventionDto,
	RunPromptInterventionResponse,
	StudentInterventionItemResult,
} from './dto/run-prompt-intervention.dto';
import type { AuthUser } from '../auth/types/authenticated-user.type';

@Injectable()
export class InterventionService {
	constructor(
		@InjectRepository(Intervention)
		private readonly interventionRepo: Repository<Intervention>,
		@InjectRepository(Course)
		private readonly courseRepo: Repository<Course>,
		@InjectRepository(CourseInstructor)
		private readonly courseInstructorRepo: Repository<CourseInstructor>,
		private readonly mcpCollector: McpContextCollectorService,
		private readonly aspEvaluator: AspEvaluatorService,
		private readonly aiGateway: AiGatewayService,
		private readonly notificationService: NotificationService,
	) {}

	/**
	 * Xử lý toàn bộ pipeline khi giảng viên nhập prompt và chọn nhóm học viên bấm "Kiểm tra"
	 */
	async runPromptIntervention(
		dto: RunPromptInterventionDto,
		actor: AuthUser,
	): Promise<RunPromptInterventionResponse> {
		// 1. Kiểm tra khoá học có tồn tại không
		const course = await this.courseRepo.findOne({
			where: { id: dto.courseId, deletedAt: IsNull() },
		});
		if (!course) {
			throw new NotFoundException(
				`Không tìm thấy khoá học với ID: ${dto.courseId}`,
			);
		}

		// 2. Kiểm tra quyền của giảng viên (admin hoặc giáo viên phụ trách khoá học)
		if (actor.role !== 'admin') {
			if (actor.role !== 'teacher') {
				throw new ForbiddenException(
					'Chỉ giảng viên hoặc quản trị viên mới có quyền thực hiện chức năng cảnh báo sớm.',
				);
			}
			const isOwner = course.ownerId === actor.id;
			const isAssigned =
				await this.courseInstructorRepo.count({
					where: { courseId: course.id, userId: actor.id },
				}) > 0;

			if (!isOwner && !isAssigned) {
				throw new ForbiddenException(
					'Bạn không được phân công giảng dạy khoá học này.',
				);
			}
		}

		// 3. Khối ASP: Phân tích prompt xem "Yêu cầu đủ rõ?"
		const promptIntent = this.aspEvaluator.evaluatePromptClarity(dto.prompt);
		if (!promptIntent.isClear) {
			return {
				isPromptClear: false,
				clarificationRequest: promptIntent.clarificationReason,
				summary: { totalEvaluated: 0, sentCount: 0, skippedCount: 0, blockedCount: 0 },
				results: [],
			};
		}

		// 4. Khối MCP: Thu thập dữ kiện học tập của từng học viên
		const studentContexts = await this.mcpCollector.collectContextsForCourse({
			courseId: dto.courseId,
			cohortId: dto.cohortId,
			studentIds: dto.studentIds,
		});

		if (studentContexts.length === 0) {
			return {
				isPromptClear: true,
				parsedIntent: {
					intentSummary: promptIntent.intentSummary,
					targetCriteria: Object.keys(promptIntent.targetCriteria),
					thresholds: promptIntent.targetCriteria,
				},
				summary: { totalEvaluated: 0, sentCount: 0, skippedCount: 0, blockedCount: 0 },
				results: [],
			};
		}

		const results: StudentInterventionItemResult[] = [];
		let sentCount = 0;
		let skippedCount = 0;
		let blockedCount = 0;

		// 5. Duyệt qua từng học viên: ASP đánh giá $\rightarrow$ AI soạn thảo $\rightarrow$ Grounding Check $\rightarrow$ Gửi thông báo
		for (const context of studentContexts) {
			const evaluation = this.aspEvaluator.evaluateStudent(
				context,
				promptIntent.targetCriteria,
			);

			const contextSummary = {
				progressPercent: context.progressPercent,
				overdueLessonsCount: context.overdueLessonsCount,
				lateSubmissionsCount: context.lateSubmissionsCount,
				averageQuizScorePercent: context.averageQuizScorePercent,
				daysSinceLastActivity: context.daysSinceLastActivity,
				riskLevel: context.latestRiskPrediction?.riskLevel ?? null,
			};

			// Nếu ASP quyết định không cần gửi push
			if (!evaluation.shouldPush) {
				skippedCount++;
				results.push({
					userId: context.userId,
					fullName: context.fullName,
					studentCode: context.studentCode,
					status: 'skipped_by_asp',
					aspReason: evaluation.reason,
					contextSummary,
				});
				continue;
			}

			// Gọi AI Gateway để soạn thông báo cá nhân hóa
			const draftedMessage = await this.aiGateway.draftInterventionMessage(
				dto.prompt,
				context,
			);

			// Kiểm tra Grounding (chống ảo giác số liệu)
			const grounding = this.aspEvaluator.checkGrounding(
				draftedMessage.content,
				context,
			);

			if (!grounding.passed) {
				blockedCount++;
				results.push({
					userId: context.userId,
					fullName: context.fullName,
					studentCode: context.studentCode,
					status: 'blocked_ungrounded',
					aspReason: evaluation.reason,
					groundingCheckPassed: false,
					groundingIssues: grounding.issues,
					generatedTitle: draftedMessage.title,
					generatedContent: draftedMessage.content,
					contextSummary,
				});
				continue;
			}

			// Nếu dryRun = true thì chỉ kiểm chứng chứ không lưu DB thật
			if (dto.dryRun) {
				sentCount++;
				results.push({
					userId: context.userId,
					fullName: context.fullName,
					studentCode: context.studentCode,
					status: 'sent',
					aspReason: `${evaluation.reason} (DryRun mode)`,
					groundingCheckPassed: true,
					generatedTitle: draftedMessage.title,
					generatedContent: draftedMessage.content,
					contextSummary,
				});
				continue;
			}

			// 6. Lưu bản ghi Intervention vào cơ sở dữ liệu
			const intervention = this.interventionRepo.create({
				courseId: dto.courseId,
				userId: context.userId,
				instructorId: actor.id,
				enrollmentId: context.enrollmentId,
                riskPredictionId: context.latestRiskPrediction?.id ?? null,
				interventionType: dto.interventionType ?? 'in_app_message',
				channel: dto.channel ?? 'in_app',
				title: draftedMessage.title,
				content: draftedMessage.content,
				recommendedLessonIds: context.recommendedLessonIds,
				status: 'sent',
				sentAt: new Date(),
				createdById: actor.id,
			});

			const savedIntervention = await this.interventionRepo.save(intervention);

			// 7. Bắn Notification cho học viên nhận thông báo
			const notification = await this.notificationService.sendNotification({
				userId: context.userId,
				notificationType: 'intervention_message',
				channel: dto.channel ?? 'in_app',
				title: draftedMessage.title,
				body: draftedMessage.content,
				relatedType: 'intervention',
				relatedId: savedIntervention.id,
				payload: { courseId: dto.courseId, interventionId: savedIntervention.id },
			});

			sentCount++;
			results.push({
				userId: context.userId,
				fullName: context.fullName,
				studentCode: context.studentCode,
				status: 'sent',
				aspReason: evaluation.reason,
				groundingCheckPassed: true,
				generatedTitle: draftedMessage.title,
				generatedContent: draftedMessage.content,
				interventionId: savedIntervention.id,
				notificationId: notification.id,
				contextSummary,
			});
		}

		return {
			isPromptClear: true,
			parsedIntent: {
				intentSummary: promptIntent.intentSummary,
				targetCriteria: Object.keys(promptIntent.targetCriteria),
				thresholds: promptIntent.targetCriteria,
			},
			summary: {
				totalEvaluated: studentContexts.length,
				sentCount,
				skippedCount,
				blockedCount,
			},
			results,
		};
	}
	/**
	 * Lấy lịch sử các hành động can thiệp trong một khoá học (dành cho giảng viên / admin)
	 */
	async findByCourse(
		courseId: string,
		actor: AuthUser,
	): Promise<Intervention[]> {
		const course = await this.courseRepo.findOne({
			where: { id: courseId, deletedAt: IsNull() },
		});
		if (!course) {
			throw new NotFoundException(`Không tìm thấy khoá học với ID: ${courseId}`);
		}

		if (actor.role !== 'admin') {
			if (actor.role !== 'teacher') {
				throw new ForbiddenException(
					'Chỉ giảng viên hoặc quản trị viên mới có quyền xem lịch sử can thiệp.',
				);
			}
			const isOwner = course.ownerId === actor.id;
			const isAssigned =
				(await this.courseInstructorRepo.count({
					where: { courseId: course.id, userId: actor.id },
				})) > 0;

			if (!isOwner && !isAssigned) {
				throw new ForbiddenException(
					'Bạn không được phân công giảng dạy khoá học này.',
				);
			}
		}

		return this.interventionRepo.find({
			where: { courseId },
			relations: { user: true, instructor: true },
			order: { createdAt: 'DESC' },
			take: 100,
		});
	}
}