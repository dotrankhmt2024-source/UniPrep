import { parseGeneratedQuestions } from './generated-question.parser';

const opts = (...correct: boolean[]) =>
	correct.map((c, i) => ({ content: `Phương án ${i + 1}`, correct: c }));

describe('parseGeneratedQuestions', () => {
	it('giữ câu đúng luật, bỏ câu sai luật', () => {
		const raw = JSON.stringify({
			questions: [
				{
					type: 'single_choice',
					content: 'Câu 1',
					explanation: 'vì…',
					options: opts(true, false, false, false),
				},
				{
					type: 'single_choice',
					content: 'Hai đáp án đúng',
					options: opts(true, true, false, false),
				},
				{
					type: 'multiple_choice',
					content: 'Câu 3',
					options: opts(true, true, false, false),
				},
				{
					type: 'true_false',
					content: 'Câu 4',
					options: [
						{ content: 'Đúng', correct: false },
						{ content: 'Sai', correct: true },
					],
				},
				{
					type: 'true_false',
					content: 'Ba phương án',
					options: opts(true, false, false),
				},
				{ type: 'essay', content: 'Loại lạ', options: [] },
				{
					type: 'single_choice',
					content: 'Trùng phương án',
					options: [
						{ content: 'A', correct: true },
						{ content: 'a', correct: false },
					],
				},
				{ type: 'single_choice', content: 'câu 1', options: opts(true, false) },
			],
		});
		const result = parseGeneratedQuestions(raw, 10);
		expect(result.map((q) => q.content)).toEqual(['Câu 1', 'Câu 3', 'Câu 4']);
		expect(result[0].explanation).toBe('vì…');
		expect(result[2].options[1]).toEqual({ content: 'Sai', correct: true });
	});

	it('nhận mảng trần, bỏ rào ```json và giới hạn số câu', () => {
		const list = [1, 2, 3].map((n) => ({
			type: 'single_choice',
			content: `Q${n}`,
			options: opts(false, true, false, false),
		}));
		const raw = '```json\n' + JSON.stringify(list) + '\n```';
		expect(parseGeneratedQuestions(raw, 2).map((q) => q.content)).toEqual([
			'Q1',
			'Q2',
		]);
	});

	it('JSON hỏng hoặc rỗng trả mảng rỗng', () => {
		expect(parseGeneratedQuestions('không phải json', 5)).toEqual([]);
		expect(parseGeneratedQuestions(null, 5)).toEqual([]);
		expect(parseGeneratedQuestions('{"questions": 3}', 5)).toEqual([]);
	});
});
