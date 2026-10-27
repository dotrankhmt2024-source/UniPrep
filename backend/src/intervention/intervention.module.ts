import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Intervention } from './entities/intervention.entity';

import { RiskPrediction } from '../analytics/entities/risk-prediction.entity';
import { ModelVersion } from '../analytics/entities/model-version.entity';
import { AIJob } from '../ai-gateway/entities/ai-job.entity';
import { User } from '../user/entities/user.entity';

import { Course } from '../course/entities/course.entity';
import { CourseInstructor } from '../course/entities/course-instructor.entity';
import { Enrollment } from '../course/entities/enrollment.entity';
import { Lesson } from '../lesson/entities/lesson.entity';
import { LessonProgress } from '../lesson/entities/lesson-progress.entity';
import { Quiz } from '../exercise/entities/quiz.entity';
import { Submission } from '../exercise/entities/submission.entity';
import { LearningEvent } from '../learning-activity/entities/learning-event.entity';

import { InterventionController } from './intervention.controller';
import { InterventionService } from './intervention.service';
import { McpContextCollectorService } from './mcp-context-collector.service';
import { AspEvaluatorService } from './asp-evaluator.service';

import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Intervention,
			RiskPrediction,
			ModelVersion,
			AIJob,
			User,
			Course,
			CourseInstructor,
			Enrollment,
			Lesson,
			LessonProgress,
			Quiz,
			Submission,
			LearningEvent,
		]),
		AiGatewayModule,
		NotificationModule,
	],
	controllers: [InterventionController],
	providers: [
		InterventionService,
		McpContextCollectorService,
		AspEvaluatorService,
	],
	exports: [InterventionService],
})
export class InterventionModule {}