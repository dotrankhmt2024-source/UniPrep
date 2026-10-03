import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { Course } from '../src/course/entities/course.entity';
import { CourseSection } from '../src/course/entities/course-section.entity';
import { Lesson } from '../src/lesson/entities/lesson.entity';
import { LessonProgress } from '../src/lesson/entities/lesson-progress.entity';
import { User } from '../src/user/entities/user.entity';

describe('Enrollment and progress (e2e)', () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let studentId: string;
	let otherStudentId: string;
	let courseId: string;
	let lessonIds: string[];
	let accessToken: string;
	let otherAccessToken: string;
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

		const student = await registerStudent('e4-student');
		const otherStudent = await registerStudent('e4-other');
		studentId = student.id;
		accessToken = student.accessToken;
		otherStudentId = otherStudent.id;
		otherAccessToken = otherStudent.accessToken;

		const courses = dataSource.getRepository(Course);
		const course = await courses.save(
			courses.create({
				code: `E4-${Date.now()}`,
				title: 'E4 progress test',
				slug: `e4-progress-${Date.now()}`,
				ownerId: studentId,
				status: 'published',
				visibility: 'public',
				enrollmentOpen: true,
			}),
		);
		courseId = course.id;

		const section = await dataSource.getRepository(CourseSection).save({
			courseId,
			title: 'Chương kiểm thử',
			orderIndex: 1,
			isPublished: true,
		});
		const lessons = await dataSource.getRepository(Lesson).save([
			{
				courseId,
				sectionId: section.id,
				title: 'Bài kiểm thử 1',
				slug: 'e4-test-lesson-1',
				orderIndex: 1,
				isPublished: true,
			},
			{
				courseId,
				sectionId: section.id,
				title: 'Bài kiểm thử 2',
				slug: 'e4-test-lesson-2',
				orderIndex: 2,
				isPublished: true,
			},
		]);
		lessonIds = lessons.map((item) => item.id);
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (courseId) await dataSource.getRepository(Course).delete(courseId);
			if (studentId) await dataSource.getRepository(User).delete(studentId);
			if (otherStudentId)
				await dataSource.getRepository(User).delete(otherStudentId);
		}
		await app?.close();
	});

	it('supports enrollment, IDOR protection, idempotent progress, resume and drop/re-enroll', async () => {
		const enrollmentResponse = await apiRequest()
			.post('/api/enrollments')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ courseId })
			.expect(201);
		const enrollmentId = responseData<{ id: string }>(
			enrollmentResponse.body,
		).id;
		await apiRequest()
			.post('/api/enrollments')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ courseId })
			.expect(409);

		const listResponse = await apiRequest()
			.get('/api/enrollments?status=active,completed')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);
		const listData = responseData<{
			items: Array<{ resumeLessonId: string | null }>;
		}>(listResponse.body);
		expect(listData.items).toHaveLength(1);
		expect(listData.items[0].resumeLessonId).toBe(lessonIds[0]);

		const initialProgress = await apiRequest()
			.get(`/api/enrollments/${enrollmentId}/progress`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);
		const initialData = responseData<{
			progressPercent: number;
			resumeLessonId: string | null;
		}>(initialProgress.body);
		expect(initialData.progressPercent).toBe(0);
		expect(initialData.resumeLessonId).toBe(lessonIds[0]);

		await apiRequest()
			.get(`/api/enrollments/${enrollmentId}`)
			.set('Authorization', `Bearer ${otherAccessToken}`)
			.expect(403);

		const firstComplete = await apiRequest()
			.post(`/api/lessons/${lessonIds[0]}/complete`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ timeSpentSeconds: 45 })
			.expect(200);
		const repeatedComplete = await apiRequest()
			.post(`/api/lessons/${lessonIds[0]}/complete`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ timeSpentSeconds: 45 })
			.expect(200);
		const firstCompleteData = responseData<{
			progressPercent: number;
			completedAt: string;
		}>(firstComplete.body);
		const repeatedCompleteData = responseData<{
			progressPercent: number;
			completedAt: string;
		}>(repeatedComplete.body);
		expect(firstCompleteData.progressPercent).toBe(50);
		expect(repeatedCompleteData.progressPercent).toBe(50);
		expect(repeatedCompleteData.completedAt).toBe(
			firstCompleteData.completedAt,
		);
		expect(
			await dataSource.getRepository(LessonProgress).count({
				where: { enrollmentId },
			}),
		).toBe(1);

		await apiRequest()
			.delete(`/api/lessons/${lessonIds[0]}/complete`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);
		const courseProgress = await apiRequest()
			.get(`/api/courses/${courseId}/progress`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);
		expect(
			responseData<{ progressPercent: number }>(courseProgress.body)
				.progressPercent,
		).toBe(0);
		await apiRequest()
			.get(`/api/courses/${courseId}/progress?userId=${otherStudentId}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(403);

		await apiRequest()
			.post(`/api/lessons/${lessonIds[0]}/complete`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ timeSpentSeconds: 10 })
			.expect(200);
		await apiRequest()
			.post(`/api/lessons/${lessonIds[1]}/complete`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ timeSpentSeconds: 10 })
			.expect(200);
		const completedProgress = await apiRequest()
			.get(`/api/enrollments/${enrollmentId}/progress`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);
		const completedData = responseData<{
			progressPercent: number;
			resumeLessonId: string | null;
		}>(completedProgress.body);
		expect(completedData.progressPercent).toBe(100);
		expect(completedData.resumeLessonId).toBeNull();
		await dataSource.getRepository(Lesson).update(lessonIds[1], {
			isPublished: false,
		});
		const afterUnpublish = await apiRequest()
			.get(`/api/enrollments/${enrollmentId}/progress`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);
		const afterUnpublishData = responseData<{
			totalLessons: number;
			completedLessons: number;
			progressPercent: number;
		}>(afterUnpublish.body);
		expect(afterUnpublishData.totalLessons).toBe(1);
		expect(afterUnpublishData.completedLessons).toBe(1);
		expect(afterUnpublishData.progressPercent).toBe(100);

		await apiRequest()
			.delete(`/api/enrollments/${enrollmentId}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200)
			.expect(({ body }) =>
				expect(responseData<{ status: string }>(body).status).toBe('dropped'),
			);
		const reopened = await apiRequest()
			.post('/api/enrollments')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ courseId })
			.expect(201);
		const reopenedData = responseData<{
			id: string;
			progressPercent: number;
		}>(reopened.body);
		expect(reopenedData.id).toBe(enrollmentId);
		expect(reopenedData.progressPercent).toBe(100);
	});

	async function registerStudent(suffix: string): Promise<{
		id: string;
		accessToken: string;
	}> {
		const response = await apiRequest()
			.post('/api/auth/register')
			.send({
				email: `${suffix}-${Date.now()}@example.test`,
				password: 'UniPrep@2026',
				fullName: `E4 ${suffix}`,
			})
			.expect(201);
		const data = responseData<{
			user: { id: string };
			accessToken: string;
		}>(response.body);
		return { id: data.user.id, accessToken: data.accessToken };
	}
});
