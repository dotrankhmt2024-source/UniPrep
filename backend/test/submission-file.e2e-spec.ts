import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { Course } from '../src/course/entities/course.entity';
import { User } from '../src/user/entities/user.entity';

/**
 * Luồng "bài tập nộp tệp" (yêu cầu 4.4) trên HTTP thật + PostgreSQL thật.
 *
 * Trọng tâm là những thứ unit test **không** chứng minh được: quyền tải tệp của người khác (IDOR),
 * thứ tự kiểm tra `415`/`413`, trạng thái `submitted` chờ chấm, và việc học viên xem lại được kết quả
 * cùng lịch sử làm bài của chính mình.
 */
describe('Submission file flow (e2e)', () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let teacherId: string;
	let studentId: string;
	let otherStudentId: string;
	let courseId: string;
	let teacherToken: string;
	let studentToken: string;
	let otherStudentToken: string;
	const responseData = <T>(body: unknown): T => (body as { data: T }).data;
	const apiRequest = () => request(app.getHttpServer() as Server);
	const pdf = () => Buffer.from('%PDF-1.4\n% UniPrep e2e\n');

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
			code: `E5F-${stamp}`,
			title: 'E5 file submission test',
			slug: `e5-file-submission-${stamp}`,
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

	it('accepts a late file submission, keeps it pending, then lets the teacher grade and the student review', async () => {
		// `closeAt` đã qua: chế độ nộp tệp vẫn cho nộp và ghi `isLate`, khác hẳn chế độ trắc nghiệm.
		const quizId = await createQuiz('E5F late file assignment', {
			submissionMode: 'file',
			maxScore: 20,
			closeAt: new Date(Date.now() - 60_000).toISOString(),
		});
		await apiRequest()
			.patch(`/api/quizzes/${quizId}/publish`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.expect(200);

		const attempt = await startAttempt(quizId, studentToken);

		// Chưa có tệp thì không được nộp — đây là ràng buộc của chế độ `file`.
		await apiRequest()
			.post('/api/submissions')
			.set('Authorization', `Bearer ${studentToken}`)
			.send({ attemptId: attempt.id })
			.expect(400);

		// Tệp ngoài whitelist bị chặn bằng `415` trước cả khi xét dung lượng.
		await apiRequest()
			.post(`/api/submissions/${attempt.id}/files`)
			.set('Authorization', `Bearer ${studentToken}`)
			.attach('file', Buffer.from('MZ'), {
				filename: 'malware.exe',
				contentType: 'application/x-msdownload',
			})
			.expect(415);

		const uploaded = await apiRequest()
			.post(`/api/submissions/${attempt.id}/files`)
			.set('Authorization', `Bearer ${studentToken}`)
			.attach('file', pdf(), {
				filename: 'Báo cáo đồ án.pdf',
				contentType: 'application/pdf',
			})
			.expect(201);
		const file = responseData<{ id: string; originalName: string }>(
			uploaded.body,
		);
		expect(file.originalName).toBe('Báo cáo đồ án.pdf');
		// `storageKey` là đường dẫn nội bộ trên đĩa — không bao giờ được trả ra API.
		expect(JSON.stringify(uploaded.body)).not.toContain('storageKey');

		// Học viên khác không được chạm vào tệp của lượt làm này (IDOR).
		await apiRequest()
			.get(`/api/submission-files/${file.id}/download`)
			.set('Authorization', `Bearer ${otherStudentToken}`)
			.expect(403);
		await apiRequest()
			.post(`/api/submissions/${attempt.id}/files`)
			.set('Authorization', `Bearer ${otherStudentToken}`)
			.attach('file', pdf(), {
				filename: 'copy.pdf',
				contentType: 'application/pdf',
			})
			.expect(403);

		const submitted = await apiRequest()
			.post('/api/submissions')
			.set('Authorization', `Bearer ${studentToken}`)
			.send({ attemptId: attempt.id })
			.expect(201);
		expect(
			responseData<{
				status: string;
				score: null;
				autoGraded: boolean;
				awaitingManualGrading: boolean;
				isLate: boolean;
				maxScore: number;
				fileCount: number;
			}>(submitted.body),
		).toMatchObject({
			status: 'submitted',
			score: null,
			autoGraded: false,
			awaitingManualGrading: true,
			isLate: true,
			maxScore: 20,
			fileCount: 1,
		});

		// Không được sửa tệp sau khi đã nộp.
		await apiRequest()
			.delete(`/api/submission-files/${file.id}`)
			.set('Authorization', `Bearer ${studentToken}`)
			.expect(409);

		const teacherFiles = await apiRequest()
			.get(`/api/submissions/${attempt.id}/files`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.expect(200);
		expect(
			responseData<{ items: unknown[]; allowUpload: boolean }>(
				teacherFiles.body,
			),
		).toMatchObject({ allowUpload: false });
		expect(
			responseData<{ items: unknown[] }>(teacherFiles.body).items,
		).toHaveLength(1);

		const download = await apiRequest()
			.get(`/api/submission-files/${file.id}/download`)
			.set('Authorization', `Bearer ${studentToken}`)
			.expect(200);
		expect(download.headers['content-disposition']).toContain('attachment;');
		expect(download.headers['content-disposition']).toContain(
			'filename*=UTF-8',
		);
		expect(download.headers['x-content-type-options']).toBe('nosniff');
		// --- Xem inline bằng token (route @Public) ---
		const fileItems = responseData<{
			allowUpload: boolean;
			items: Array<{ id: string; viewUrl: string; canPreview: boolean }>;
		}>(teacherFiles.body).items;
		expect(fileItems[0].canPreview).toBe(true);
		expect(fileItems[0].viewUrl).toContain('?token=');

		const token =
			new URL(fileItems[0].viewUrl, 'http://localhost:3000').searchParams.get(
				'token',
			) ?? '';

		// 1) có token → 200 + inline
		const inlineView = await apiRequest()
			.get(`/api/submission-files/${file.id}/view`)
			.query({ token })
			.expect(200);
		expect(inlineView.headers['content-disposition']).toContain('inline');
		expect(inlineView.headers['x-content-type-options']).toBe('nosniff');

		// 2) không token → 401
		await apiRequest().get(`/api/submission-files/${file.id}/view`).expect(401);

		// 3) token của tệp A gọi cho tệp B → 401
		// Dùng một UUID v4 hợp lệ nhưng KHÔNG tồn tại: token bị từ chối trước khi tra DB.
		const otherFileId = '00000000-0000-4000-8000-000000000000';
		await apiRequest()
			.get(`/api/submission-files/${otherFileId}/view`)
			.query({ token })
			.expect(401);
		// Chốt bài mà không nhập điểm là lỗi nghiệp vụ, không phải một bài `graded` với điểm rỗng.
		await apiRequest()
			.patch(`/api/submissions/${attempt.id}/feedback`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.send({ teacherFeedback: 'Thiếu điểm' })
			.expect(400);

		await apiRequest()
			.patch(`/api/submissions/${attempt.id}/feedback`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.send({ score: 18, teacherFeedback: 'Trình bày tốt.' })
			.expect(200);

		const review = await apiRequest()
			.get(`/api/submissions/${attempt.id}/review`)
			.set('Authorization', `Bearer ${studentToken}`)
			.expect(200);
		expect(
			responseData<{
				score: number;
				status: string;
				teacherFeedback: string;
				files: unknown[];
			}>(review.body),
		).toMatchObject({
			score: 18,
			status: 'graded',
			teacherFeedback: 'Trình bày tốt.',
		});
		expect(responseData<{ files: unknown[] }>(review.body).files).toHaveLength(
			1,
		);

		// Lịch sử làm bài của học viên: chỉ thấy bài của chính mình, kèm số tệp và hình thức nộp.
		const history = await apiRequest()
			.get('/api/submissions')
			.set('Authorization', `Bearer ${studentToken}`)
			.query({ quizId })
			.expect(200);
		const items = responseData<{
			items: Array<{
				submissionMode: string;
				fileCount: number;
				status: string;
			}>;
		}>(history.body).items;
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			submissionMode: 'file',
			fileCount: 1,
			status: 'graded',
		});
	});

	it('grades the quiz part automatically and still waits for the teacher in mixed mode', async () => {
		const quizId = await createQuiz('E5F mixed assignment', {
			submissionMode: 'mixed',
			maxScore: 5,
			maxAttempts: 1,
		});
		const questionId = await addQuestion(quizId, 'single_choice', [
			{ content: 'Correct', isCorrect: true },
			{ content: 'Wrong', isCorrect: false },
		]);
		await apiRequest()
			.patch(`/api/quizzes/${quizId}/publish`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.expect(200);

		const attempt = await startAttempt(quizId, studentToken);
		await apiRequest()
			.post(`/api/submissions/${attempt.id}/files`)
			.set('Authorization', `Bearer ${studentToken}`)
			.attach('file', Buffer.from('bài làm'), {
				filename: 'bai-lam.txt',
				contentType: 'text/plain',
			})
			.expect(201);

		const submitted = await apiRequest()
			.post('/api/submissions')
			.set('Authorization', `Bearer ${studentToken}`)
			.send({
				attemptId: attempt.id,
				answers: [{ questionId, selectedOptionIds: [] }],
			})
			.expect(201);
		expect(
			responseData<{
				status: string;
				score: number;
				autoGraded: boolean;
				maxScore: number;
			}>(submitted.body),
		).toMatchObject({
			status: 'submitted',
			score: 0,
			autoGraded: false,
			// Tổng điểm = điểm câu hỏi (1) + điểm phần nộp tệp (5).
			maxScore: 6,
		});
	});

	it('rejects file uploads for quiz-only assessments and enforces the per-attempt file limit', async () => {
		const quizId = await createQuiz('E5F quiz only', {
			submissionMode: 'quiz',
		});
		await addQuestion(quizId, 'single_choice', [
			{ content: 'Correct', isCorrect: true },
			{ content: 'Wrong', isCorrect: false },
		]);
		await apiRequest()
			.patch(`/api/quizzes/${quizId}/publish`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.expect(200);
		const quizAttempt = await startAttempt(quizId, studentToken);
		await apiRequest()
			.post(`/api/submissions/${quizAttempt.id}/files`)
			.set('Authorization', `Bearer ${studentToken}`)
			.attach('file', pdf(), {
				filename: 'report.pdf',
				contentType: 'application/pdf',
			})
			.expect(400);

		const fileQuizId = await createQuiz('E5F limit', {
			submissionMode: 'file',
			maxAttempts: 1,
		});
		await apiRequest()
			.patch(`/api/quizzes/${fileQuizId}/publish`)
			.set('Authorization', `Bearer ${teacherToken}`)
			.expect(200);
		const attempt = await startAttempt(fileQuizId, studentToken);
		for (let index = 1; index <= 5; index += 1) {
			await apiRequest()
				.post(`/api/submissions/${attempt.id}/files`)
				.set('Authorization', `Bearer ${studentToken}`)
				.attach('file', Buffer.from(`tệp ${index}`), {
					filename: `t${index}.txt`,
					contentType: 'text/plain',
				})
				.expect(201);
		}
		await apiRequest()
			.post(`/api/submissions/${attempt.id}/files`)
			.set('Authorization', `Bearer ${studentToken}`)
			.attach('file', Buffer.from('tệp 6'), {
				filename: 't6.txt',
				contentType: 'text/plain',
			})
			.expect(400);
	});

	/**
	 * Chặn tái phát: `maxScore = 0` từng lọt qua DTO (`@Min(0)`) rồi đâm vào CHECK
	 * `chk_quizzes_max_score` (`max_score > 0`) của Postgres ⇒ `500` kèm message SQL tiếng Anh lộ tên
	 * bảng/constraint. Đúng phải là `400` ở tầng validate, trước khi chạm DB.
	 */
	it('rejects a zero max score as a validation error, not a database error', async () => {
		const response = await apiRequest()
			.post('/api/quizzes')
			.set('Authorization', `Bearer ${teacherToken}`)
			.send({
				courseId,
				title: 'E5F zero max score',
				submissionMode: 'file',
				maxScore: 0,
			})
			.expect(400);

		// Message phải là câu tiếng Việt của validator, không phải lỗi SQL.
		expect(JSON.stringify(response.body)).toContain(
			'Điểm tối đa phần nộp tệp phải lớn hơn 0',
		);
		expect(JSON.stringify(response.body)).not.toContain(
			'chk_quizzes_max_score',
		);
	});

	async function register(
		suffix: string,
	): Promise<{ id: string; accessToken: string }> {
		const response = await apiRequest()
			.post('/api/auth/register')
			.send({
				email: `e5f-${suffix}-${Date.now()}@example.test`,
				password: 'UniPrep@2026',
				fullName: `E5F ${suffix}`,
			})
			.expect(201);
		const data = responseData<{ user: { id: string }; accessToken: string }>(
			response.body,
		);
		return { id: data.user.id, accessToken: data.accessToken };
	}

	async function createQuiz(
		title: string,
		extra: Record<string, unknown>,
	): Promise<string> {
		const response = await apiRequest()
			.post('/api/quizzes')
			.set('Authorization', `Bearer ${teacherToken}`)
			.send({ courseId, title, ...extra })
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
			.send({ content: 'E5F question', type, points: 1, options })
			.expect(201);
		return responseData<{ id: string }>(response.body).id;
	}

	async function startAttempt(
		forQuizId: string,
		token: string,
	): Promise<{ id: string }> {
		const response = await apiRequest()
			.post(`/api/quizzes/${forQuizId}/attempts`)
			.set('Authorization', `Bearer ${token}`)
			.send({})
			.expect(201);
		return responseData<{ id: string }>(response.body);
	}
});
