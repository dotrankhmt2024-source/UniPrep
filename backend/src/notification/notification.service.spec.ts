import { NotificationService } from './notification.service';

/**
 * Repo giả: `manager.query` trả lời theo nội dung SQL, `save` ghi lại các dòng được lưu.
 */
function setup(answers: (sql: string, params: unknown[]) => unknown[]) {
	const saved: Record<string, unknown>[] = [];
	const repo = {
		create: jest.fn((value: Record<string, unknown>) => value),
		save: jest.fn(
			(value: Record<string, unknown> | Record<string, unknown>[]) => {
				const rows = Array.isArray(value) ? value : [value];
				saved.push(...rows);
				return Promise.resolve(value);
			},
		),
		manager: {
			query: jest.fn((sql: string, params: unknown[] = []) =>
				Promise.resolve(answers(sql, params)),
			),
		},
	};
	const service = new NotificationService(repo as never);
	return { service, repo, saved };
}

describe('NotificationService', () => {
	describe('sendMany', () => {
		it('skips users who already received the same type for the same object', async () => {
			const { service, saved } = setup((sql) =>
				sql.includes('FROM notifications') ? [{ user_id: 'u1' }] : [],
			);
			const sent = await service.sendMany(['u1', 'u2', 'u2'], {
				notificationType: 'new_content',
				title: 't',
				body: 'b',
				relatedType: 'lesson',
				relatedId: 'lesson-1',
			});
			expect(sent).toBe(1);
			expect(saved.map((row) => row.userId)).toEqual(['u2']);
		});

		it('does not touch the database when there is nobody to notify', async () => {
			const { service, repo } = setup(() => []);
			expect(
				await service.sendMany([], {
					notificationType: 'system',
					title: 't',
					body: 'b',
				}),
			).toBe(0);
			expect(repo.save).not.toHaveBeenCalled();
		});
	});

	describe('notifyRiskEscalations', () => {
		const escalations = [
			{ userId: 's1', predictionId: 'p1' },
			{ userId: 's2', predictionId: 'p2' },
		];

		it('notifies students and course staff, skipping students alerted recently', async () => {
			const { service, saved } = setup((sql) => {
				if (sql.includes('FROM alert_settings')) return [];
				if (sql.includes('SELECT title FROM courses'))
					return [{ title: 'CTDL' }];
				if (sql.includes("notification_type = 'risk_alert'"))
					return [{ user_id: 's1' }];
				if (sql.includes('course_instructors')) return [{ user_id: 'teacher' }];
				if (sql.includes('SELECT full_name')) return [{ full_name: 'B' }];
				return [];
			});
			const result = await service.notifyRiskEscalations('c1', escalations);
			expect(result).toEqual({ students: 1, instructors: 1 });
			const student = saved.find((row) => row.userId === 's2');
			expect(student).toMatchObject({
				notificationType: 'risk_alert',
				relatedType: 'risk_prediction',
				relatedId: 'p2',
			});
			expect(saved.some((row) => row.userId === 's1')).toBe(false);
			expect(
				saved.find((row) => row.userId === 'teacher')?.payload,
			).toMatchObject({
				link: '/teacher/courses/c1/analytics',
			});
		});

		it('respects alert_settings that turn notifications off', async () => {
			const { service, repo } = setup((sql) => {
				if (sql.includes('FROM alert_settings'))
					return [{ notify_student: false, notify_instructor: false }];
				if (sql.includes('SELECT title FROM courses'))
					return [{ title: 'CTDL' }];
				return [];
			});
			expect(await service.notifyRiskEscalations('c1', escalations)).toEqual({
				students: 0,
				instructors: 0,
			});
			expect(repo.save).not.toHaveBeenCalled();
		});
	});

	describe('safely', () => {
		it('swallows errors so the main action still succeeds', async () => {
			const { service } = setup(() => []);
			await expect(
				service.safely('test', () => Promise.reject(new Error('boom'))),
			).resolves.toBeUndefined();
		});
	});

	describe('notifyGradePublished', () => {
		it('mentions the score and marks re-grades', async () => {
			const { service, saved } = setup(() => [
				{
					id: 'sub1',
					user_id: 's1',
					quiz_id: 'q1',
					course_id: 'c1',
					score: '8.50',
					max_score: '10.00',
					quiz_title: 'Bài 1',
					has_feedback: true,
				},
			]);
			await service.notifyGradePublished('sub1', true);
			expect(saved[0]).toMatchObject({
				userId: 's1',
				notificationType: 'grade_published',
				relatedId: 'sub1',
			});
			expect(saved[0].title).toContain('cập nhật');
			expect(saved[0].body).toContain('8.5/10');
		});
	});
});
