import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertSetting } from '../admin/entities/alert-setting.entity';
import { CourseModule } from '../course/course.module';
import { Intervention } from '../intervention/entities/intervention.entity';
import { NotificationModule } from '../notification/notification.module';
import { DeepSeekClient } from '../tutor/deepseek.client';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ModelVersion } from './entities/model-version.entity';
import { RiskPrediction } from './entities/risk-prediction.entity';
import { RiskEngineService } from './risk/risk-engine.service';
import { RiskFeatureService } from './risk/risk-feature.service';
import { RiskInterventionService } from './risk/risk-intervention.service';
import { RiskService } from './risk/risk.service';

/**
 * Learning Analytics & cảnh báo sớm (E8–E10): dashboard theo thời gian, dự đoán rủi ro bằng luật ASP
 * (clingo-wasm) hiệu chỉnh trên OULAD, giải thích theo luật, lập kế hoạch và gửi can thiệp, tự chấm
 * kết quả can thiệp. Xem `docs/03-architecture/risk-asp-oulad.md`.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([
			RiskPrediction,
			ModelVersion,
			AlertSetting,
			Intervention,
		]),
		CourseModule,
		NotificationModule,
	],
	controllers: [AnalyticsController],
	providers: [
		AnalyticsService,
		RiskService,
		RiskEngineService,
		RiskFeatureService,
		RiskInterventionService,
		DeepSeekClient,
	],
	exports: [RiskService],
})
export class AnalyticsModule {}
