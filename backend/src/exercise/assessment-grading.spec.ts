import { BadRequestException } from '@nestjs/common';
import { gradeObjectiveQuestions } from './assessment-grading';

const singleQuestion = {
	id: 'question-1',
	questionType: 'single_choice' as const,
	points: 2,
	options: [
		{ id: 'option-correct', isCorrect: true },
		{ id: 'option-wrong', isCorrect: false },
	],
};

const multiQuestion = {
	id: 'question-2',
	questionType: 'multiple_choice' as const,
	points: 3,
	options: [
		{ id: 'option-a', isCorrect: true },
		{ id: 'option-b', isCorrect: true },
		{ id: 'option-c', isCorrect: false },
	],
};

describe('gradeObjectiveQuestions', () => {
	it('awards full points for an exact single-choice answer', () => {
		const result = gradeObjectiveQuestions(
			[singleQuestion],
			[
				{
					questionId: singleQuestion.id,
					selectedOptionIds: ['option-correct'],
				},
			],
		);

		expect(result).toMatchObject({ score: 2, correctCount: 1 });
		expect(result.answers[0].pointsAwarded).toBe(2);
	});

	it('grades multiple-choice selections independent of selection order', () => {
		const result = gradeObjectiveQuestions(
			[multiQuestion],
			[
				{
					questionId: multiQuestion.id,
					selectedOptionIds: ['option-b', 'option-a'],
				},
			],
		);

		expect(result).toMatchObject({ score: 3, correctCount: 1 });
	});

	it('awards zero for a partially correct multiple-choice answer', () => {
		const result = gradeObjectiveQuestions(
			[multiQuestion],
			[{ questionId: multiQuestion.id, selectedOptionIds: ['option-a'] }],
		);

		expect(result).toMatchObject({ score: 0, correctCount: 0 });
	});

	it('awards zero for an unanswered question', () => {
		const result = gradeObjectiveQuestions([singleQuestion], []);

		expect(result).toMatchObject({ score: 0, correctCount: 0 });
		expect(result.answers[0].selectedOptionIds).toEqual([]);
	});

	it('rejects an option that belongs to another question', () => {
		expect(() =>
			gradeObjectiveQuestions(
				[singleQuestion],
				[
					{
						questionId: singleQuestion.id,
						selectedOptionIds: ['foreign-option'],
					},
				],
			),
		).toThrow(BadRequestException);
	});

	it('rejects duplicate answers for one question', () => {
		expect(() =>
			gradeObjectiveQuestions(
				[singleQuestion],
				[
					{
						questionId: singleQuestion.id,
						selectedOptionIds: ['option-correct'],
					},
					{
						questionId: singleQuestion.id,
						selectedOptionIds: ['option-wrong'],
					},
				],
			),
		).toThrow(BadRequestException);
	});

	it('rejects multiple selections for single-choice questions', () => {
		expect(() =>
			gradeObjectiveQuestions(
				[singleQuestion],
				[
					{
						questionId: singleQuestion.id,
						selectedOptionIds: ['option-correct', 'option-wrong'],
					},
				],
			),
		).toThrow(BadRequestException);
	});

	it('rejects answers for a question outside the quiz', () => {
		expect(() =>
			gradeObjectiveQuestions(
				[singleQuestion],
				[
					{
						questionId: 'other-question',
						selectedOptionIds: ['option-correct'],
					},
				],
			),
		).toThrow(BadRequestException);
	});
});
