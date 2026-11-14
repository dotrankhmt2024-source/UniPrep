/**
 * Câu trả lời cuối của trợ giảng được ép thành JSON qua tool `submit_answer` (hoặc JSON mode khi
 * model lỡ trả lời bằng văn bản). File này giữ schema và bước kiểm tra/chuẩn hoá trước khi lưu.
 *
 * "Có căn cứ" nghĩa là: mỗi ý lấy từ học liệu phải trỏ về một đoạn (`chunk_id`) có thật mà model đã
 * đọc qua tool. Backend kiểm tra mã đoạn tồn tại và gắn kèm tên bài, heading, trích đoạn, link nguồn
 * để giao diện hiển thị — model không tự viết các thông tin đó nên không bịa được nguồn.
 */

export const SUBMIT_ANSWER_TOOL = 'submit_answer';

export interface RawAnswer {
	message: string;
	/** Mã đoạn theo đúng thứ tự `[1]`, `[2]`… trong `message`. */
	citations: string[];
	/** `false` khi học liệu của khoá không có thông tin để trả lời. */
	grounded: boolean;
	suggestions: string[];
}

export interface TutorCitation {
	index: number;
	chunkId: string;
	lessonId: string;
	lessonKey: string;
	lessonTitle: string;
	heading: string;
	excerpt: string;
	sourceUrl: string | null;
}

export interface TutorAnswer {
	message: string;
	citations: TutorCitation[];
	grounded: boolean;
	suggestions: string[];
	/** Ghi chú của backend khi phải sửa câu trả lời (bỏ mã đoạn không tồn tại...). */
	notes: string[];
	/** `tool`: model gọi submit_answer; `json_mode`: phải định dạng lại bằng JSON mode. */
	source: 'tool' | 'json_mode';
}

/** JSON Schema của `submit_answer`, cũng dùng làm hướng dẫn cho JSON mode. */
export const ANSWER_SCHEMA = {
	type: 'object',
	properties: {
		message: {
			type: 'string',
			description:
				'Câu trả lời bằng tiếng Việt, định dạng markdown (được dùng **đậm**, danh sách, `code`, khối ```code```). ' +
				'Sau mỗi ý lấy từ học liệu, đặt số trích dẫn dạng [1], [2] ứng với vị trí trong "citations". ' +
				'Thuật ngữ và lệnh giữ nguyên tiếng Anh như trong tài liệu.',
		},
		citations: {
			type: 'array',
			description:
				'Mã đoạn (chunk_id, ví dụ "2.3#4") đã đọc qua tool, theo thứ tự [1], [2]... Chỉ dùng mã có trong kết quả tool.',
			items: { type: 'string' },
		},
		grounded: {
			type: 'boolean',
			description:
				'true nếu câu trả lời dựa trên học liệu của khoá học; false nếu học liệu không có thông tin (khi đó citations rỗng).',
		},
		suggestions: {
			type: 'array',
			description:
				'Tối đa 3 câu hỏi tiếp theo (tiếng Việt) mà người học có thể bấm để hỏi tiếp, nằm trong phạm vi khoá học.',
			items: { type: 'string' },
		},
	},
	required: ['message', 'citations', 'grounded', 'suggestions'],
} as const;

export const ANSWER_JSON_EXAMPLE = JSON.stringify({
	message:
		'Để tạo nhánh mới và chuyển sang nhánh đó, dùng `git checkout -b <tên-nhánh>` [1]. Nhánh giúp bạn phát triển tính năng tách biệt khỏi nhánh mặc định [2].',
	citations: ['3.1#2', '3.1#1'],
	grounded: true,
	suggestions: ['Làm sao để merge nhánh vào main?'],
});

const text = (value: unknown, max: number): string =>
	typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = (value: unknown, max: number): unknown[] =>
	Array.isArray(value) ? value.slice(0, max) : [];

/** Đọc JSON từ chuỗi (bỏ được rào ```json nếu model lỡ thêm). */
export const parseJsonObject = (
	raw: string | null | undefined,
): Record<string, unknown> | null => {
	if (!raw?.trim()) return null;
	const cleaned = raw
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/```$/, '')
		.trim();
	try {
		const value: unknown = JSON.parse(cleaned);
		return value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
};

/** Kiểm tra cấu trúc; trả về bản đã chuẩn hoá và danh sách lỗi để model sửa. */
export const normalizeAnswer = (
	input: Record<string, unknown> | null,
): { answer: RawAnswer | null; errors: string[] } => {
	if (!input)
		return {
			answer: null,
			errors: ['Tham số không phải một JSON object hợp lệ.'],
		};
	const errors: string[] = [];

	const message = text(input.message, 8000);
	if (!message) errors.push('Thiếu "message".');

	const citations: string[] = [];
	list(input.citations, 12).forEach((item) => {
		const id = text(item, 40);
		if (id && !citations.includes(id)) citations.push(id);
	});

	const grounded =
		typeof input.grounded === 'boolean' ? input.grounded : citations.length > 0;
	if (grounded && !citations.length)
		errors.push(
			'grounded = true nhưng "citations" rỗng: hãy trích ít nhất một đoạn đã đọc, hoặc đặt grounded = false nếu học liệu không có thông tin.',
		);

	const highest = Math.max(
		0,
		...[...message.matchAll(/\[(\d{1,2})\]/g)].map((match) => Number(match[1])),
	);
	if (highest > citations.length)
		errors.push(
			`"message" dùng trích dẫn [${highest}] nhưng "citations" chỉ có ${citations.length} phần tử.`,
		);

	const suggestions = list(input.suggestions, 3)
		.map((item) => text(item, 200))
		.filter(Boolean);

	return {
		answer: message ? { message, citations, grounded, suggestions } : null,
		errors,
	};
};
