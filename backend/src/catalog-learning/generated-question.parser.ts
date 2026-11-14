export type GeneratedQuestionType =
	'single_choice' | 'multiple_choice' | 'true_false';

export interface GeneratedQuestion {
	type: GeneratedQuestionType;
	content: string;
	explanation: string | null;
	options: { content: string; correct: boolean }[];
}

const TYPES = new Set<GeneratedQuestionType>([
	'single_choice',
	'multiple_choice',
	'true_false',
]);

const text = (value: unknown, max: number): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

/** Bỏ rào ```json … ``` nếu model lỡ bọc kết quả. */
function stripFence(raw: string): string {
	const match = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
	return (match ? match[1] : raw).trim();
}

/**
 * Đọc và **kiểm tra** câu hỏi do model sinh — chỉ giữ câu đúng luật mà `ExerciseService` áp cho
 * câu hỏi nhập tay (true_false đúng 2 phương án; single/true_false đúng 1 đáp án; multiple ≥ 1).
 * Câu sai luật bị bỏ thay vì làm hỏng cả bài.
 */
export function parseGeneratedQuestions(
	raw: string | null,
	limit: number,
): GeneratedQuestion[] {
	if (!raw) return [];
	let data: unknown;
	try {
		data = JSON.parse(stripFence(raw));
	} catch {
		return [];
	}
	const list = Array.isArray(data)
		? data
		: Array.isArray((data as { questions?: unknown })?.questions)
			? (data as { questions: unknown[] }).questions
			: [];

	const result: GeneratedQuestion[] = [];
	const seen = new Set<string>();
	for (const item of list) {
		if (result.length >= limit) break;
		const q = item as Record<string, unknown>;
		const type = q.type as GeneratedQuestionType;
		const content = text(q.content, 4000);
		if (!TYPES.has(type) || !content || seen.has(content.toLowerCase()))
			continue;

		const options = (Array.isArray(q.options) ? q.options : [])
			.map((o: Record<string, unknown>) => ({
				content: text(o?.content, 1000),
				correct: o?.correct === true,
			}))
			.filter(
				(o): o is { content: string; correct: boolean } => o.content !== null,
			);
		const distinct = new Set(options.map((o) => o.content.toLowerCase()));
		const correct = options.filter((o) => o.correct).length;

		if (
			distinct.size !== options.length ||
			options.length < 2 ||
			options.length > 6
		)
			continue;
		if (type === 'true_false' && options.length !== 2) continue;
		if (type !== 'multiple_choice' && correct !== 1) continue;
		if (type === 'multiple_choice' && (correct < 1 || options.length < 3))
			continue;

		seen.add(content.toLowerCase());
		result.push({
			type,
			content,
			explanation: text(q.explanation, 2000),
			options,
		});
	}
	return result;
}
