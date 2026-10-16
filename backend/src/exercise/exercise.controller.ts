import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import {
	CreateQuestionDto,
	CreateQuizDto,
	FeedbackDto,
	QuizListQueryDto,
	SubmitQuizDto,
	SubmissionListQueryDto,
	UpdateQuestionDto,
	UpdateQuizDto,
} from './dto/assessment.dto';
import { ExerciseService } from './exercise.service';

@Controller()
export class ExerciseController {
	constructor(private readonly exerciseService: ExerciseService) {}

	@Get('quizzes')
	findQuizzes(
		@CurrentUser() actor: AuthUser,
		@Query() query: QuizListQueryDto,
	) {
		return this.exerciseService.findQuizzes(actor, query);
	}

	@Post('quizzes')
	@Roles('teacher', 'admin')
	createQuiz(@CurrentUser() actor: AuthUser, @Body() dto: CreateQuizDto) {
		return this.exerciseService.createQuiz(actor, dto);
	}

	@Get('quizzes/:id')
	getQuiz(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.getQuiz(id, actor);
	}

	@Patch('quizzes/:id')
	@Roles('teacher', 'admin')
	updateQuiz(
		@Param('id') id: string,
		@CurrentUser() actor: AuthUser,
		@Body() dto: UpdateQuizDto,
	) {
		return this.exerciseService.updateQuiz(id, actor, dto);
	}

	@Delete('quizzes/:id')
	@Roles('teacher', 'admin')
	deleteQuiz(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.deleteQuiz(id, actor);
	}

	@Patch('quizzes/:id/publish')
	@Roles('teacher', 'admin')
	publishQuiz(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.publishQuiz(id, actor);
	}

	@Get('quizzes/:id/questions')
	@Roles('teacher', 'admin')
	findQuestions(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.findQuestions(id, actor);
	}

	@Post('quizzes/:id/questions')
	@Roles('teacher', 'admin')
	addQuestion(
		@Param('id') id: string,
		@CurrentUser() actor: AuthUser,
		@Body() dto: CreateQuestionDto,
	) {
		return this.exerciseService.addQuestion(id, actor, dto);
	}

	@Patch('questions/:id')
	@Roles('teacher', 'admin')
	updateQuestion(
		@Param('id') id: string,
		@CurrentUser() actor: AuthUser,
		@Body() dto: UpdateQuestionDto,
	) {
		return this.exerciseService.updateQuestion(id, actor, dto);
	}

	@Delete('questions/:id')
	@Roles('teacher', 'admin')
	deleteQuestion(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.deleteQuestion(id, actor);
	}

	@Post('quizzes/:id/attempts')
	@Roles('student')
	startAttempt(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.startAttempt(id, actor);
	}

	@Get('quizzes/:id/attempts')
	findQuizAttempts(
		@Param('id') id: string,
		@CurrentUser() actor: AuthUser,
		@Query() query: SubmissionListQueryDto,
	) {
		return this.exerciseService.findQuizAttempts(id, actor, query);
	}

	@Get('attempts/:id')
	getAttempt(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.getAttempt(id, actor);
	}

	@Post('submissions')
	@Roles('student')
	submit(@CurrentUser() actor: AuthUser, @Body() dto: SubmitQuizDto) {
		return this.exerciseService.submit(actor, dto);
	}

	@Get('submissions')
	findSubmissions(
		@CurrentUser() actor: AuthUser,
		@Query() query: SubmissionListQueryDto,
	) {
		return this.exerciseService.findSubmissions(actor, query);
	}

	@Get('submissions/:id')
	getSubmission(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.getSubmission(id, actor);
	}

	@Get('submissions/:id/review')
	reviewSubmission(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
		return this.exerciseService.reviewSubmission(id, actor);
	}

	@Patch('submissions/:id/feedback')
	@Roles('teacher', 'admin')
	updateFeedback(
		@Param('id') id: string,
		@CurrentUser() actor: AuthUser,
		@Body() dto: FeedbackDto,
	) {
		return this.exerciseService.updateFeedback(id, actor, dto);
	}
}
