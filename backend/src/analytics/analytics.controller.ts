import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiResponseDto, buildSuccess } from '../common/dto/api-response.dto';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import { AnalyticsService } from './analytics.service';
import {
	AnalyticsQueryDto,
	DraftInterventionDto,
	SendInterventionDto,
} from './dto/analytics.dto';
import { CALIBRATION } from './risk/risk-engine.service';
import { RiskInterventionService } from './risk/risk-intervention.service';
import { RiskService } from './risk/risk.service';

/**
 * Learning Analytics & cảnh báo sớm — chỉ giảng viên phụ trách khoá (theo phạm vi lớp) và admin.
 */
@ApiTags('Analytics & Early Warning')
@ApiBearerAuth()
@Roles('teacher', 'admin')
@Controller('analytics')
export class AnalyticsController {
	constructor(
		private readonly analytics: AnalyticsService,
		private readonly risk: RiskService,
		private readonly interventions: RiskInterventionService,
	) {}

	/** Thông tin bộ cảnh báo: nguồn dữ liệu hiệu chỉnh, ngưỡng, trọng số, số đo trên OULAD. */
	@Get('risk-model')
	@ApiOperation({
		summary: 'Thông tin và số đo đánh giá của bộ cảnh báo sớm ASP',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	model(): ApiResponseDto<typeof CALIBRATION> {
		return buildSuccess(CALIBRATION);
	}

	@Get('courses/:courseId/dashboard')
	@ApiOperation({
		summary:
			'Dashboard khoá học: tổng quan, chuỗi theo tuần, phễu bài học, hiệu quả can thiệp',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async dashboard(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@Query() query: AnalyticsQueryDto,
		@CurrentUser() actor: AuthUser,
	) {
		const scope = await this.analytics.resolveScope(
			courseId,
			actor,
			query.cohortId,
		);
		// Dự đoán quá cũ thì chạy lại trước khi đọc; can thiệp đủ 7 ngày thì tự chấm kết quả.
		await this.risk.ensureFresh(courseId);
		await this.risk.evaluateOutcomes(courseId);
		const [cohorts, overview, timeseries, lessons, outcomes] =
			await Promise.all([
				this.analytics.cohorts(scope),
				this.analytics.overview(scope),
				this.analytics.timeseries(scope, query.weeks ?? 10),
				this.analytics.lessonFunnel(scope),
				this.analytics.interventionOutcomes(scope),
			]);
		return buildSuccess({ cohorts, overview, timeseries, lessons, outcomes });
	}

	@Get('courses/:courseId/risks')
	@ApiOperation({
		summary:
			'Học viên theo mức rủi ro hiện tại, kèm lý do và hành động ASP đề xuất',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async risks(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@Query() query: AnalyticsQueryDto,
		@CurrentUser() actor: AuthUser,
	) {
		const scope = await this.analytics.resolveScope(
			courseId,
			actor,
			query.cohortId,
		);
		await this.risk.ensureFresh(courseId);
		const [items, cutoffs, computedAt] = await Promise.all([
			this.risk.currentRisks(courseId, {
				cohortIds: scope.cohortIds,
				capacity: query.capacity ?? 10,
			}),
			this.risk.cutoffsFor(courseId),
			this.risk.lastComputedAt(courseId),
		]);
		return buildSuccess({
			items,
			cutoffs,
			computedAt,
			capacity: query.capacity ?? 10,
		});
	}

	@Post('courses/:courseId/risks/run')
	@ApiOperation({
		summary: 'Chạy lại dự đoán rủi ro cho cả khoá (ASP trên dữ liệu hiện tại)',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async run(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@CurrentUser() actor: AuthUser,
	) {
		await this.analytics.resolveScope(courseId, actor);
		return buildSuccess(
			await this.risk.runForCourse(courseId, 'manual'),
			'Đã chạy dự đoán rủi ro',
		);
	}

	@Get('courses/:courseId/students/:userId')
	@ApiOperation({
		summary:
			'Chi tiết một học viên: lịch sử rủi ro, hoạt động theo tuần, các can thiệp',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async student(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@Param('userId', UUID_V4_PIPE) userId: string,
		@Query() query: AnalyticsQueryDto,
		@CurrentUser() actor: AuthUser,
	) {
		const scope = await this.analytics.resolveScope(courseId, actor);
		await this.analytics.assertLearnerInScope(scope, userId);
		const [history, weekly, interventions] = await Promise.all([
			this.risk.history(courseId, userId),
			this.analytics.learnerWeekly(courseId, userId, query.weeks ?? 10),
			this.analytics.interventionsOf(courseId, userId),
		]);
		return buildSuccess({ history, weekly, interventions });
	}

	@Post('courses/:courseId/interventions/draft')
	@ApiOperation({
		summary:
			'Soạn nháp tin can thiệp (LLM có kiểm tra số liệu, hoặc mẫu soạn sẵn)',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async draft(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@Body() dto: DraftInterventionDto,
		@CurrentUser() actor: AuthUser,
	) {
		const scope = await this.analytics.resolveScope(courseId, actor);
		await this.analytics.assertLearnerInScope(scope, dto.userId);
		return buildSuccess(
			await this.interventions.draft(courseId, dto.userId, dto.type),
		);
	}

	@Post('courses/:courseId/interventions')
	@ApiOperation({
		summary: 'Gửi can thiệp (đã được giảng viên duyệt) tới học viên',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async send(
		@Param('courseId', UUID_V4_PIPE) courseId: string,
		@Body() dto: SendInterventionDto,
		@CurrentUser() actor: AuthUser,
	) {
		const scope = await this.analytics.resolveScope(courseId, actor);
		await this.analytics.assertLearnerInScope(scope, dto.userId);
		const saved = await this.interventions.send(courseId, actor, dto);
		return buildSuccess(
			{ id: saved.id, status: saved.status, sentAt: saved.sentAt },
			'Đã gửi can thiệp',
		);
	}
}
