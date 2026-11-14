import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { CourseSection } from '../course/entities/course-section.entity';
import { Course } from '../course/entities/course.entity';
import { Quiz } from '../exercise/entities/quiz.entity';
import { LessonProgress } from '../lesson/entities/lesson-progress.entity';
import { Enrollment } from '../course/entities/enrollment.entity';
import { QuizOption } from '../exercise/entities/quiz-option.entity';
import { QuizQuestion } from '../exercise/entities/quiz-question.entity';
import { Lesson } from '../lesson/entities/lesson.entity';
import { DeepSeekClient } from '../tutor/deepseek.client';
import { User } from '../user/entities/user.entity';
import { CatalogContentService } from './catalog-content.service';
import { CatalogCourseService } from './catalog-course.service';
import { CatalogLearningController } from './catalog-learning.controller';
import { CustomQuizService } from './custom-quiz.service';

/**
 * Học trên nội dung Catalog: danh sách môn cho người học, mở khoá học từ đề cương, AI sinh bài
 * học và câu hỏi. Chỉ dùng repository trực tiếp (không import `LessonModule`/`ExerciseModule`) để
 * hai module đó import ngược lại `CatalogContentService` mà không tạo vòng phụ thuộc.
 */
@Module({
	imports: [
		CatalogModule,
		TypeOrmModule.forFeature([
			Course,
			Enrollment,
			User,
			Lesson,
			QuizQuestion,
			QuizOption,
			Quiz,
			CourseSection,
			LessonProgress,
		]),
	],
	controllers: [CatalogLearningController],
	providers: [
		CatalogCourseService,
		CatalogContentService,
		CustomQuizService,
		DeepSeekClient,
	],
	exports: [CatalogContentService],
})
export class CatalogLearningModule {}
