import { BadRequestException } from '@nestjs/common';
import type { SubmitAnswerDto } from './dto/assessment.dto';

interface GradingQuestion {
	id: string;
	questionType:
		| 'single_choice'
		| 'multiple_choice'
		| 'true_false'
		| 'short_answer'
		| 'essay';
	points: number;
	options: Array<{ id: string; isCorrect: boolean }>;
}

export type GradedAnswer = {
	questionId: string;
	selectedOptionIds: string[];
	isCorrect: boolean;
	pointsAwarded: number;
};

export const gradeObjectiveQuestions = (
	questions: GradingQuestion[],
	answers: SubmitAnswerDto[],
): { answers: GradedAnswer[]; score: number; correctCount: number } => {
	const submitted = new Map(
		answers.map((answer) => [answer.questionId, answer]),
	);
	if (submitted.size !== answers.length) {
		throw new BadRequestException('Câu trả lời bị trùng.');
	}
	const questionIds = new Set(questions.map((question) => question.id));
	if (
		[...submitted.keys()].some((questionId) => !questionIds.has(questionId))
	) {
		throw new BadRequestException('Câu hỏi không thuộc bài kiểm tra.');
	}

	let score = 0;
	let correctCount = 0;
	const gradedAnswers = questions.map((question) => {
		if (
			!['single_choice', 'multiple_choice', 'true_false'].includes(
				question.questionType,
			)
		) {
			throw new BadRequestException(
				'Phiên bản hiện tại chỉ tự chấm câu hỏi trắc nghiệm.',
			);
		}
		const selectedOptionIds =
			submitted.get(question.id)?.selectedOptionIds ?? [];
		if (
			selectedOptionIds.some(
				(optionId) =>
					!question.options.some((option) => option.id === optionId),
			)
		) {
			throw new BadRequestException('Đáp án không thuộc câu hỏi.');
		}
		if (
			['single_choice', 'true_false'].includes(question.questionType) &&
			selectedOptionIds.length > 1
		) {
			throw new BadRequestException('Câu hỏi này chỉ nhận một đáp án.');
		}

		const correctOptionIds = question.options
			.filter((option) => option.isCorrect)
			.map((option) => option.id)
			.sort();
		const selectedSorted = [...selectedOptionIds].sort();
		const isCorrect =
			selectedSorted.length === correctOptionIds.length &&
			selectedSorted.every(
				(optionId, index) => optionId === correctOptionIds[index],
			);
		const pointsAwarded = isCorrect ? Number(question.points) : 0;
		if (isCorrect) correctCount += 1;
		score += pointsAwarded;
		return {
			questionId: question.id,
			selectedOptionIds,
			isCorrect,
			pointsAwarded,
		};
	});

	return {
		answers: gradedAnswers,
		score: Math.round(score * 100) / 100,
		correctCount,
	};
};
