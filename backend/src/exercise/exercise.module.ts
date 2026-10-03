import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseModule } from '../course/course.module';
import { Enrollment } from '../course/entities/enrollment.entity';
import { Course } from '../course/entities/course.entity';
import { Quiz } from './entities/quiz.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { QuizOption } from './entities/quiz-option.entity';
import { Submission } from './entities/submission.entity';
import { SubmissionAnswer } from './entities/submission-answer.entity';
import { ExerciseController } from './exercise.controller';
import { ExerciseService } from './exercise.service';

@Module({
	imports: [
		CourseModule,
		TypeOrmModule.forFeature([
			Course,
			Enrollment,
			Quiz,
			QuizQuestion,
			QuizOption,
			Submission,
			SubmissionAnswer,
		]),
	],
	controllers: [ExerciseController],
	providers: [ExerciseService],
})
export class ExerciseModule {}
