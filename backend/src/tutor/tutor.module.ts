import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseModule } from '../course/course.module';
import { Lesson } from '../lesson/entities/lesson.entity';
import { DeepSeekClient } from './deepseek.client';
import { TutorSession } from './entities/tutor-session.entity';
import { TutorStep } from './entities/tutor-step.entity';
import { TutorController } from './tutor.controller';
import { TutorKnowledgeService } from './tutor-knowledge.service';
import { TutorService } from './tutor.service';
import { TutorTools } from './tutor.tools';

/**
 * Trợ giảng AI có căn cứ (agent + tool call + trajectory, port từ module `advisor` của DACN2).
 *
 * Import `CourseModule` để dùng `CourseAccessService` — cùng một câu trả lời "ai được xem khoá
 * nào" với trang khoá học. `Lesson` chỉ được **đọc** để dựng chỉ mục học liệu.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([TutorSession, TutorStep, Lesson]),
		CourseModule,
	],
	controllers: [TutorController],
	providers: [TutorService, TutorTools, TutorKnowledgeService, DeepSeekClient],
})
export class TutorModule {}
