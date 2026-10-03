import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { Course } from '../src/course/entities/course.entity';
import { Quiz } from '../src/exercise/entities/quiz.entity';
import { Submission } from '../src/exercise/entities/submission.entity';
import { User } from '../src/user/entities/user.entity';

describe('Assessment flow (e2e)', () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let teacherId: string;
	let studentId: string;
	let otherStudentId: string;
	let courseId: string;
	let teacherToken: string;
	let studentToken: string;
	let otherStudentToken: string;
	let quizId: string;
	let zeroScoreQuizId: string;
	let expiredQuizId: string;
	const responseData = <T>(body: unknown): T => (body as { data: T }).data;
	const apiRequest = () => request(app.getHttpServer() as Server);

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();
		app = moduleRef.createNestApplication();
		app.setGlobalPrefix('api');
		app.useGlobalPipes(
			new ValidationPipe({ transform: true, whitelist: true }),
		);
		app.useGlobalInterceptors(new TransformResponseInterceptor());
		app.useGlobalFilters(new AllExceptionsFilter());
		await app.init();
		dataSource = app.get(DataSource);
		await dataSource.runMigrations();

		const teacher = await register('teacher');
		const student = await register('student');
		const otherStudent = await register('other');
		teacherId = teacher.id;
		teacherToken = teacher.accessToken;
		studentId = student.id;
		studentToken = student.accessToken;
		otherStudentId = otherStudent.id;
		otherStudentToken = otherStudent.accessToken;
		await dataSource.getRepository(User).update(teacherId, { role: 'teacher' });

		const stamp = Date.now();
		const course = await dataSource.getRepository(Course).save({
			code: `E5-${stamp}`,
			title: 'E5 assessment test',
			slug: `e5-assessment-${stamp}`,
			ownerId: teacherId,
			status: 'published',
			visibility: 'public',
			enrollmentOpen: true,
		});
		courseId = course.id;
		await apiRequest()
			.post('/api/enrollments')
			.set('Authorization', `Bearer ${studentToken}`)
			.send({ courseId })
			.expect(201);

		quizId = await createPublishedQuiz('E5 max score', 2);
		await addQuestion(quizId, 'single_choice', [
			{ content: 'Correct', isCorrect: true },
			{ content: 'Wrong', isCorrect: false },
		]);
		await addQuestion(quizId, 'multiple_choice', [
			{ content: 'Choice A', isCorrect: true },
			{ content: 'Choice B', isCorrect: true },
			{ content: 'Choice C', isCorrect: false },
		]);
		await apiRequest()
			.patch(`/api/quizzes/${quizId}/publish`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.expect(200);
		await dataSource.getRepository(Quiz).update(quizId, { passScore: 3 });
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (courseId) await dataSource.getRepository(Course).delete(courseId);
			for (const userId of [teacherId, studentId, otherStudentId]) {
				if (userId) await dataSource.getRepository(User).delete(userId);
			}
		}
		await app?.close();
	});

	it('hides correct options before submission, blocks IDOR, grades and rejects duplicate submission', async () => {
		const quizResponse = await apiRequest()
			.get(`/api/quizzes/${quizId}`)
			.set('Authorization', `Bearer ${studentToken}`)
			.expect(200);
		const quiz = responseData<{
			questions: Array<{ options: Array<Record<string, unknown>> }>;
		}>(quizResponse.body);
		expect(quiz.questions).toHaveLength(2);
		expect(
			quiz.questions
				.flatMap((question) => question.options)
				.every((option) => !('isCorrect' in option)),
		).toBe(true);
		const teacherQuestions = await apiRequest()
			.get(`/api/quizzes/${quizId}/questions`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.expect(200);
		expect(
			responseData<{
				items: Array<{ options: Array<{ isCorrect: boolean }> }>;
			}>(teacherQuestions.body)
				.items.flatMap((question) => question.options)
				.some((option) => option.isCorrect),
		).toBe(true);

		const attemptResponse = await apiRequest()
			.post(`/api/quizzes/${quizId}/attempts`)
			.set('Authorization', `Bearer ${studentToken}`)
			.send({})
			.expect(201);
		const attempt = responseData<{
			id: string;
			questions: Array<{ id: string; options: Array<{ id: string }> }>;
		}>(attemptResponse.body);
		const attemptsResponse = await apiRequest()
			.get(`/api/quizzes/${quizId}/attempts`)
			.set('Authorization', `Bearer ${studentToken}`)
			.expect(200);
		expect(
			responseData<{ items: Array<{ id: string; status: string }> }>(
				attemptsResponse.body,
			).items,
		).toContainEqual(
			expect.objectContaining({ id: attempt.id, status: 'in_progress' }),
		);
		await apiRequest()
			.get(`/api/attempts/${attempt.id}`)
			.set('Authorization', `Bearer ${otherStudentToken}`)
			.expect(403);
		await apiRequest()
			.post(`/api/quizzes/${quizId}/attempts`)
			.set('Authorization', `Bearer ${otherStudentToken}`)
			.send({})
			.expect(403);

		const [single, multiple] = attempt.questions;
		const correctSingle = single.options[0].id;
		const correctMulti = multiple.options
			.slice(0, 2)
			.map((option) => option.id);
		const submitted = await apiRequest()
			.post('/api/submissions')
			.set('Authorization', `Bearer ${studentToken}`)
			.send({
				attemptId: attempt.id,
				answers: [
					{ questionId: single.id, selectedOptionIds: [correctSingle] },
					{ questionId: multiple.id, selectedOptionIds: correctMulti },
				],
			})
			.expect(201);
		const result = responseData<{
			id: string;
			score: number;
			maxScore: number;
			correctCount: number;
			passed: boolean;
		}>(submitted.body);
		expect(result).toMatchObject({
			score: 3,
			maxScore: 3,
			correctCount: 2,
			passed: true,
		});

		const review = await apiRequest()
			.get(`/api/submissions/${result.id}/review`)
			.set('Authorization', `Bearer ${studentToken}`)
			.expect(200);
		expect(responseData<{ items: unknown[] }>(review.body).items).toHaveLength(
			2,
		);
		const teacherList = await apiRequest()
			.get(`/api/submissions?quizId=${quizId}`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.expect(200);
		expect(
			responseData<{ items: Array<{ student: { id: string } }> }>(
				teacherList.body,
			).items[0].student.id,
		).toBe(studentId);
		await apiRequest()
			.patch(`/api/submissions/${result.id}/feedback`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.send({ score: 2.5, teacherFeedback: 'Trình bày tốt.' })
			.expect(200);
		const submissionDetail = await apiRequest()
			.get(`/api/submissions/${result.id}`)
			.set('Authorization', `Bearer ${studentToken}`)
			.expect(200);
		expect(
			responseData<{ teacherFeedback: string }>(submissionDetail.body)
				.teacherFeedback,
		).toBe('Trình bày tốt.');
		await apiRequest()
			.post('/api/submissions')
			.set('Authorization', `Bearer ${studentToken}`)
			.send({
				attemptId: attempt.id,
				answers: [
					{ questionId: single.id, selectedOptionIds: [correctSingle] },
					{ questionId: multiple.id, selectedOptionIds: correctMulti },
				],
			})
			.expect(409);
	});

	it('records zero score for wrong and unanswered choices', async () => {
		zeroScoreQuizId = await createPublishedQuiz('E5 zero score', 1);
		const questionId = await addQuestion(zeroScoreQuizId, 'single_choice', [
			{ content: 'Correct', isCorrect: true },
			{ content: 'Wrong', isCorrect: false },
		]);
		await apiRequest()
			.patch(`/api/quizzes/${zeroScoreQuizId}/publish`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.expect(200);
		const attemptResponse = await apiRequest()
			.post(`/api/quizzes/${zeroScoreQuizId}/attempts`)
			.set('Authorization', `Bearer ${studentToken}`)
			.send({})
			.expect(201);
		const attempt = responseData<{ id: string }>(attemptResponse.body);
		const response = await apiRequest()
			.post('/api/submissions')
			.set('Authorization', `Bearer ${studentToken}`)
			.send({
				attemptId: attempt.id,
				answers: [{ questionId, selectedOptionIds: [] }],
			})
			.expect(201);
		expect(
			responseData<{ score: number; correctCount: number }>(response.body),
		).toMatchObject({ score: 0, correctCount: 0 });
	});

	it('marks timed-out attempts expired and blocks further submission', async () => {
		expiredQuizId = await createPublishedQuiz('E5 expired', 2, 1);
		const questionId = await addQuestion(expiredQuizId, 'single_choice', [
			{ content: 'Correct', isCorrect: true },
			{ content: 'Wrong', isCorrect: false },
		]);
		await apiRequest()
			.patch(`/api/quizzes/${expiredQuizId}/publish`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.expect(200);
		const attemptResponse = await apiRequest()
			.post(`/api/quizzes/${expiredQuizId}/attempts`)
			.set('Authorization', `Bearer ${studentToken}`)
			.send({})
			.expect(201);
		const attempt = responseData<{ id: string }>(attemptResponse.body);
		await dataSource.getRepository(Submission).update(attempt.id, {
			startedAt: new Date(Date.now() - 120_000),
		});
		const expired = await apiRequest()
			.get(`/api/attempts/${attempt.id}`)
			.set('Authorization', `Bearer ${studentToken}`)
			.expect(200);
		expect(responseData<{ status: string }>(expired.body).status).toBe(
			'expired',
		);
		await apiRequest()
			.post('/api/submissions')
			.set('Authorization', `Bearer ${studentToken}`)
			.send({
				attemptId: attempt.id,
				answers: [{ questionId, selectedOptionIds: [] }],
			})
			.expect(409);
	});

	async function register(
		suffix: string,
	): Promise<{ id: string; accessToken: string }> {
		const response = await apiRequest()
			.post('/api/auth/register')
			.send({
				email: `e5-${suffix}-${Date.now()}@example.test`,
				password: 'UniPrep@2026',
				fullName: `E5 ${suffix}`,
			})
			.expect(201);
		const data = responseData<{ user: { id: string }; accessToken: string }>(
			response.body,
		);
		return { id: data.user.id, accessToken: data.accessToken };
	}

	async function createPublishedQuiz(
		title: string,
		maxAttempts: number,
		timeLimitMinutes?: number,
	): Promise<string> {
		const response = await apiRequest()
			.post('/api/quizzes')
			.set('Authorization', `Bearer ${teacherToken}`)
			.send({ courseId, title, maxAttempts, timeLimitMinutes })
			.expect(201);
		return responseData<{ id: string }>(response.body).id;
	}

	async function addQuestion(
		forQuizId: string,
		type: 'single_choice' | 'multiple_choice',
		options: Array<{ content: string; isCorrect: boolean }>,
	): Promise<string> {
		const response = await apiRequest()
			.post(`/api/quizzes/${forQuizId}/questions`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.send({
				content: 'E5 test question',
				type,
				points: type === 'single_choice' ? 1 : 2,
				options,
			})
			.expect(201);
		return responseData<{ id: string }>(response.body).id;
	}
});
