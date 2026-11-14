import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogContentService } from '../catalog-learning/catalog-content.service';
import { Lesson } from '../lesson/entities/lesson.entity';
import type { ChatToolDefinition } from './deepseek.client';
import { ANSWER_SCHEMA, SUBMIT_ANSWER_TOOL } from './tutor.answer';
import type { RawAnswer, TutorCitation } from './tutor.answer';
import { TutorKnowledgeService } from './tutor-knowledge.service';

/** Ngữ cảnh của một lượt: khoá học mà trợ giảng được phép đọc. */
export interface TurnContext {
	courseId: string;
}

const SEARCH_TEXT_LIMIT = 1500;
const READ_LIMIT = 12_000;

export const TOOL_DEFINITIONS: ChatToolDefinition[] = [
	{
		type: 'function',
		function: {
			name: 'search_materials',
			description:
				'Tìm các đoạn liên quan trong học liệu của khoá học (BM25 theo từ khoá). Truyền từ khoá CÙNG NGÔN NGỮ với học ' +
				'liệu (học liệu tiếng Anh: ví dụ "create branch checkout", "merge conflict resolve"). Có thể gọi nhiều lần ' +
				'với các cách diễn đạt khác nhau. Kết quả gồm chunk_id dùng để trích dẫn.',
			parameters: {
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'Từ khoá cùng ngôn ngữ với học liệu, 2-8 từ',
					},
					lesson: {
						type: 'string',
						description:
							'Tuỳ chọn: chỉ tìm trong một bài, theo mã bài dạng "2.3"',
					},
					limit: {
						type: 'integer',
						description: 'Số đoạn tối đa (mặc định 5, tối đa 8)',
					},
				},
				required: ['query'],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'read_lesson',
			description:
				'Đọc tuần tự các đoạn của một bài học (khi cần ngữ cảnh đầy đủ hơn kết quả tìm kiếm, ví dụ các bước ' +
				'của một quy trình). Trả về tối đa khoảng 12.000 ký tự mỗi lần; dùng next_offset để đọc tiếp.',
			parameters: {
				type: 'object',
				properties: {
					lesson: {
						type: 'string',
						description: 'Mã bài dạng "2.3" (xem mục lục trong system prompt)',
					},
					offset: {
						type: 'integer',
						description: 'Vị trí đoạn bắt đầu (mặc định 0)',
					},
				},
				required: ['lesson'],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: SUBMIT_ANSWER_TOOL,
			description:
				'Gửi câu trả lời cuối cho người học. Bắt buộc gọi đúng một lần ở cuối mỗi lượt.',
			parameters: ANSWER_SCHEMA,
		},
	},
];

@Injectable()
export class TutorTools {
	private readonly logger = new Logger(TutorTools.name);

	constructor(
		private readonly knowledge: TutorKnowledgeService,
		private readonly content: CatalogContentService,
		@InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
	) {}

	/**
	 * Bắt đầu soạn nội dung cho bài trống (chạy nền, không chờ): sinh một bài mất cỡ vài chục giây,
	 * quá lâu để giữ vòng tool call. Lượt sau chỉ mục tự dựng lại vì `updated_at` của bài đổi.
	 */
	private warmUp(lessonId: string): void {
		void this.lessons
			.findOne({ where: { id: lessonId } })
			.then((lesson) => lesson && this.content.ensureLessonContent(lesson))
			.catch((error: unknown) =>
				this.logger.warn(
					`Không soạn được nội dung bài ${lessonId}: ${error instanceof Error ? error.message : String(error)}`,
				),
			);
	}

	async execute(
		name: string,
		args: Record<string, unknown>,
		ctx: TurnContext,
	): Promise<unknown> {
		const index = await this.knowledge.getIndex(ctx.courseId);

		if (name === 'search_materials') {
			const query = typeof args.query === 'string' ? args.query.trim() : '';
			if (!query) return { error: 'Thiếu "query"' };
			const lessonKey =
				typeof args.lesson === 'string' && args.lesson.trim()
					? args.lesson.trim()
					: undefined;
			const limit = Math.min(
				8,
				Math.max(1, Number.isInteger(args.limit) ? Number(args.limit) : 5),
			);
			const hits = this.knowledge.search(index, query, { lessonKey, limit });
			const emptyKeys = this.knowledge.emptyLessonKeys(index);
			const scoped = lessonKey
				? index.lessons.find((item) => item.key === lessonKey)
				: undefined;
			return {
				query,
				total_chunks: index.chunks.length,
				results: hits.map(({ chunk, score }) => ({
					chunk_id: chunk.id,
					lesson: chunk.lessonKey,
					lesson_title: chunk.lessonTitle,
					heading: chunk.heading || null,
					score: Math.round(score * 100) / 100,
					text:
						chunk.text.length > SEARCH_TEXT_LIMIT
							? `${chunk.text.slice(0, SEARCH_TEXT_LIMIT)}…`
							: chunk.text,
				})),
				lessons_without_content: emptyKeys.length ? emptyKeys : undefined,
				hint: scoped?.empty
					? `Bài ${scoped.key} chưa có nội dung nên không tìm được gì trong bài này.`
					: hits.length
						? undefined
						: 'Không có đoạn nào khớp. Thử từ khoá khác, đồng nghĩa, hoặc đọc bài liên quan bằng read_lesson.' +
							(emptyKeys.length
								? ` Lưu ý: các bài ${emptyKeys.join(', ')} chưa có nội dung, nếu chủ đề này thuộc một bài trong đó (đối chiếu tên bài trong mục lục) thì tự giảng theo tên bài, không trích dẫn.`
								: ''),
			};
		}

		if (name === 'read_lesson') {
			const key = typeof args.lesson === 'string' ? args.lesson.trim() : '';
			const lesson = index.lessons.find((item) => item.key === key);
			if (!lesson)
				return {
					error: `Không có bài "${key}". Mã bài hợp lệ: ${index.lessons.map((item) => item.key).join(', ')}`,
				};
			if (lesson.empty) {
				if (lesson.generatable) this.warmUp(lesson.lessonId);
				return {
					lesson: lesson.key,
					title: lesson.title,
					chunks: [],
					next_offset: null,
					status: 'no_content',
					note: lesson.generatable
						? 'Bài này chưa có nội dung; hệ thống vừa bắt đầu soạn (mất khoảng một phút). Không có gì để trích dẫn. Tự giảng nội dung theo tên bài (không trích dẫn), không cần báo người học.'
						: 'Bài này chưa có nội dung. Không có gì để trích dẫn; tự giảng nội dung theo tên bài, không cần báo người học.',
				};
			}
			const all = index.chunks.filter((chunk) => chunk.lessonKey === key);
			const offset = Math.max(
				0,
				Number.isInteger(args.offset) ? Number(args.offset) : 0,
			);
			const chunks: {
				chunk_id: string;
				heading: string | null;
				text: string;
			}[] = [];
			let size = 0;
			let next = offset;
			for (const chunk of all.slice(offset)) {
				if (chunks.length && size + chunk.text.length > READ_LIMIT) break;
				chunks.push({
					chunk_id: chunk.id,
					heading: chunk.heading || null,
					text: chunk.text,
				});
				size += chunk.text.length;
				next += 1;
			}
			return {
				lesson: lesson.key,
				title: lesson.title,
				original_title: lesson.originalTitle,
				source_url: lesson.sourceUrl,
				chunks,
				next_offset: next < all.length ? next : null,
			};
		}

		return { error: `Không có tool "${name}"` };
	}

	/** Đổi mã đoạn thành trích dẫn đầy đủ; trả kèm các mã không tồn tại để báo model sửa. */
	async enrichCitations(
		answer: RawAnswer,
		ctx: TurnContext,
	): Promise<{ citations: TutorCitation[]; unknown: string[] }> {
		const index = await this.knowledge.getIndex(ctx.courseId);
		const citations: TutorCitation[] = [];
		const unknown: string[] = [];
		answer.citations.forEach((id) => {
			const chunk = index.byId.get(id);
			if (!chunk) {
				unknown.push(id);
				return;
			}
			const lesson = index.lessons.find((item) => item.key === chunk.lessonKey);
			citations.push({
				index: citations.length + 1,
				chunkId: chunk.id,
				lessonId: chunk.lessonId,
				lessonKey: chunk.lessonKey,
				lessonTitle: chunk.lessonTitle,
				heading: chunk.heading,
				excerpt:
					chunk.text.length > 320 ? `${chunk.text.slice(0, 320)}…` : chunk.text,
				sourceUrl: lesson?.sourceUrl ?? null,
			});
		});
		return { citations, unknown };
	}
}
