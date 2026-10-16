import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { Enrollment } from '../course/entities/enrollment.entity';
import type { LessonProgress } from './entities/lesson-progress.entity';
import { LessonService } from './lesson.service';

describe('LessonService progress', () => {
	const actor: AuthUser = {
		id: '11111111-1111-4111-8111-111111111111',
		email: 'student@example.test',
		role: 'student',
		status: 'active',
	};
	const enrollment = {
		id: '22222222-2222-4222-8222-222222222222',
		userId: actor.id,
		courseId: '33333333-3333-4333-8333-333333333333',
		status: 'active',
		progressPercent: 0,
		completedAt: null,
		lastActivityAt: null,
	} as Enrollment;
	const lesson = {
		id: '44444444-4444-4444-8444-444444444444',
		courseId: enrollment.courseId,
		sectionId: '55555555-5555-4555-8555-555555555555',
		isPublished: true,
		deletedAt: null,
	} as never;

	let progressRow: Partial<LessonProgress> | null;
	let service: LessonService;
	let progressRepository: {
		findOne: jest.Mock;
		upsert: jest.Mock;
		createQueryBuilder: jest.Mock;
		save: jest.Mock;
	};
	let enrollmentRepository: {
		count: jest.Mock;
		findOne: jest.Mock;
		save: jest.Mock;
	};
	let lessonsRepository: { findOne: jest.Mock; count: jest.Mock };

	beforeEach(() => {
		enrollment.status = 'active';
		enrollment.progressPercent = 0;
		enrollment.completedAt = null;
		enrollment.lastActivityAt = null;
		progressRow = null;
		const progressQuery = {
			innerJoin: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getCount: jest.fn(() =>
				Promise.resolve(progressRow?.status === 'completed' ? 1 : 0),
			),
		};
		progressRepository = {
			findOne: jest.fn(() => Promise.resolve(progressRow)),
			upsert: jest.fn((values: Partial<LessonProgress>) => {
				progressRow = {
					...values,
					id: '66666666-6666-4666-8666-666666666666',
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				return Promise.resolve();
			}),
			createQueryBuilder: jest.fn(() => progressQuery),
			save: jest.fn((value: Partial<LessonProgress>) => {
				progressRow = value;
				return Promise.resolve(value);
			}),
		};
		enrollmentRepository = {
			count: jest.fn().mockResolvedValue(1),
			findOne: jest.fn().mockResolvedValue(enrollment),
			save: jest.fn((value: Enrollment) => Promise.resolve(value)),
		};
		lessonsRepository = {
			findOne: jest.fn().mockResolvedValue(lesson),
			count: jest.fn().mockResolvedValue(2),
		};

		service = new LessonService(
			{} as never,
			lessonsRepository as never,
			{} as never,
			progressRepository as never,
			{} as never,
			enrollmentRepository as never,
			{
				findCourseOrFail: jest.fn().mockResolvedValue({
					id: enrollment.courseId,
					status: 'published',
					visibility: 'public',
				}),
			} as never,
			{} as never,
			{} as never,
		);
	});

	it('keeps repeated completion idempotent and calculates 50 percent', async () => {
		const first = await service.completeLesson('lesson-id', 30, actor);
		const firstCompletedAt = first.completedAt;
		const second = await service.completeLesson('lesson-id', 30, actor);

		expect(first.progressPercent).toBe(50);
		expect(second.progressPercent).toBe(50);
		expect(second.completedAt).toEqual(firstCompletedAt);
		expect(progressRepository.upsert).toHaveBeenCalledTimes(1);
		expect(progressRow?.timeSpentSeconds).toBe(30);
	});

	it('returns zero percent when the only completed lesson is uncompleted', async () => {
		await service.completeLesson('lesson-id', 30, actor);
		const result = await service.uncompleteLesson('lesson-id', actor);

		expect(result.state).toBe('not_started');
		expect(result.progressPercent).toBe(0);
		expect(progressRow?.status).toBe('not_started');
	});

	it('reaches 100 percent when all currently published lessons are completed', async () => {
		lessonsRepository.count.mockResolvedValue(1);
		progressRow = { status: 'in_progress' };
		const result = await service.completeLesson('lesson-id', 30, actor);

		expect(result.progressPercent).toBe(100);
		expect(enrollment.status).toBe('completed');
	});

	it('rejects progress writes when the student is not enrolled', async () => {
		enrollmentRepository.count.mockResolvedValue(0);

		await expect(
			service.completeLesson('lesson-id', 30, actor),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(progressRepository.upsert).not.toHaveBeenCalled();
	});
});
