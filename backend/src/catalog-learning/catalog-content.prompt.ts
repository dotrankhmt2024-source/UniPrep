import type { ChatMessage } from '../tutor/deepseek.client';

/** Ngữ cảnh lấy từ đề cương bên Catalog để AI soạn nội dung bám đúng môn học. */
export interface LessonPromptContext {
	courseCode: string;
	courseName: string;
	objectives: string | null;
	references: string | null;
	topicTitle: string;
	skillName: string;
	/** Các kỹ năng khác trong cùng chủ đề — để bài không lấn sang phần của bài khác. */
	siblingSkills: string[];
	outcomes: string[];
}

export interface QuizPromptContext {
	courseCode: string;
	courseName: string;
	topicTitle: string;
	skills: string[];
	outcomes: string[];
	/** Nội dung các bài đã sinh trong chủ đề (đã cắt ngắn) — câu hỏi phải bám vào đây. */
	lessonExcerpts: string;
	questionCount: number;
}

const clip = (text: string | null, max: number) =>
	!text ? '' : text.length > max ? `${text.slice(0, max)}…` : text;

export function buildLessonMessages(ctx: LessonPromptContext): ChatMessage[] {
	const system = [
		'Bạn là giảng viên đại học soạn bài giảng tiếng Việt cho sinh viên.',
		'Viết nội dung một bài học bằng Markdown, chính xác về chuyên môn, dễ hiểu.',
		'Cấu trúc bắt buộc:',
		'## Mục tiêu — 2–4 gạch đầu dòng.',
		'## Nội dung — giải thích khái niệm, có tiêu đề ### cho từng ý; dùng bảng, công thức hoặc khối code khi phù hợp.',
		'## Ví dụ — ít nhất một ví dụ có lời giải từng bước.',
		'## Tóm tắt — 3–5 ý chính.',
		'## Câu hỏi tự kiểm tra — 3 câu ngắn (không kèm đáp án).',
		'Chỉ trình bày đúng phạm vi kỹ năng được giao; các kỹ năng khác trong chủ đề có bài riêng.',
		'Không bịa trích dẫn, số liệu hay tên tài liệu. Độ dài khoảng 700–1200 từ.',
		'Trả về đúng nội dung Markdown của bài, không thêm lời dẫn.',
	].join('\n');

	const user = [
		`Môn học: ${ctx.courseCode} — ${ctx.courseName}`,
		ctx.objectives ? `Mục tiêu môn học:\n${clip(ctx.objectives, 1500)}` : '',
		ctx.references
			? `Tài liệu tham khảo của môn:\n${clip(ctx.references, 800)}`
			: '',
		`Chủ đề (chương): ${ctx.topicTitle}`,
		ctx.outcomes.length
			? `Chuẩn đầu ra liên quan:\n- ${ctx.outcomes.join('\n- ')}`
			: '',
		ctx.siblingSkills.length
			? `Các bài khác trong chủ đề (không trình bày ở đây):\n- ${ctx.siblingSkills.join('\n- ')}`
			: '',
		`Hãy soạn bài học cho kỹ năng: **${ctx.skillName}**`,
	]
		.filter(Boolean)
		.join('\n\n');

	return [
		{ role: 'system', content: system },
		{ role: 'user', content: user },
	];
}

export function buildQuizMessages(ctx: QuizPromptContext): ChatMessage[] {
	const system = [
		'Bạn là giảng viên ra đề trắc nghiệm tiếng Việt cho sinh viên đại học.',
		'Trả về JSON đúng định dạng:',
		'{"questions":[{"type":"single_choice"|"multiple_choice"|"true_false","content":"...","explanation":"...","options":[{"content":"...","correct":true|false}]}]}',
		'Quy tắc:',
		'- single_choice: 4 phương án, đúng 1 phương án đúng.',
		'- multiple_choice: 4–5 phương án, từ 2 phương án đúng trở lên.',
		'- true_false: đúng 2 phương án "Đúng" và "Sai", 1 phương án đúng.',
		'- Phủ đều các kỹ năng của chủ đề; trộn mức nhớ, hiểu và vận dụng (có câu tính toán/tình huống nếu môn cho phép).',
		'- Phương án nhiễu phải hợp lý; không dùng "Tất cả đều đúng".',
		'- explanation giải thích ngắn vì sao đáp án đúng.',
		'- Bám nội dung bài học được cung cấp; không hỏi ngoài phạm vi.',
	].join('\n');

	const user = [
		`Môn học: ${ctx.courseCode} — ${ctx.courseName}`,
		`Chủ đề: ${ctx.topicTitle}`,
		`Các kỹ năng:\n- ${ctx.skills.join('\n- ')}`,
		ctx.outcomes.length ? `Chuẩn đầu ra:\n- ${ctx.outcomes.join('\n- ')}` : '',
		ctx.lessonExcerpts ? `Nội dung bài học:\n${ctx.lessonExcerpts}` : '',
		`Tạo ${ctx.questionCount} câu hỏi (khoảng 60% single_choice, 20% multiple_choice, 20% true_false). Trả về json.`,
	]
		.filter(Boolean)
		.join('\n\n');

	return [
		{ role: 'system', content: system },
		{ role: 'user', content: user },
	];
}
