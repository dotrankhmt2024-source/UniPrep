import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from '../lesson/entities/lesson.entity';

/**
 * Kho học liệu cho RAG của trợ giảng AI.
 *
 * Nguồn là **nội dung bài học đã công bố** của khoá học (giảng viên/admin soạn hoặc import). Mỗi bài
 * được cắt thành đoạn (chunk) theo heading markdown, rồi tìm bằng BM25 ngay trong bộ nhớ.
 *
 * Vì sao không dùng bảng chunk + full-text search của Postgres: một khoá học chỉ vài chục bài, tính
 * lại trong bộ nhớ mất vài mili giây, và chỉ mục luôn khớp với nội dung hiện tại (giảng viên sửa bài
 * là trợ giảng thấy ngay, không có bước "đánh chỉ mục lại" để quên). Chỉ mục được cache theo khoá
 * học và tự dựng lại khi `updated_at` lớn nhất hoặc số bài thay đổi.
 *
 * Mã đoạn dạng `2.3#4` (chương 2, bài 3, đoạn 4): ngắn, đọc được và model chép lại chính xác hơn
 * nhiều so với UUID.
 */

export interface KnowledgeLesson {
	/** `2.3` = chương 2, bài 3 theo thứ tự hiển thị. */
	key: string;
	lessonId: string;
	title: string;
	sectionTitle: string;
	/** Tiêu đề H1 gốc của tài liệu (nếu có), ví dụ tên trang GitHub Docs. */
	originalTitle: string | null;
	sourceUrl: string | null;
	chunkCount: number;
	/**
	 * Bài chưa có nội dung (`chunkCount = 0`). Bài tạo từ Catalog được AI soạn lần đầu khi có người
	 * mở bài (`CatalogContentService.ensureLessonContent`), nên mục lục có thể đi trước học liệu:
	 * trợ giảng phải biết bài nào đang trống để không coi "không tìm thấy" là "khoá học không dạy".
	 */
	empty: boolean;
	/** Bài trống nhưng sinh được nội dung (có `catalog_key`). */
	generatable: boolean;
}

export interface KnowledgeChunk {
	id: string;
	lessonKey: string;
	lessonId: string;
	lessonTitle: string;
	/** Đường heading trong bài, ví dụ "Cloning a repository › Troubleshooting". */
	heading: string;
	text: string;
	tokens: string[];
}

interface CourseIndex {
	version: string;
	lessons: KnowledgeLesson[];
	chunks: KnowledgeChunk[];
	byId: Map<string, KnowledgeChunk>;
	docFreq: Map<string, number>;
	avgLength: number;
}

export interface SearchHit {
	chunk: KnowledgeChunk;
	score: number;
}

const CHUNK_TARGET = 1200;
const CHUNK_MAX = 1800;

const STOPWORDS = new Set(
	(
		'a an the and or but if then else of to in on at by for with from as is are was were be been ' +
		'being it its this that these those you your we our they their he she i me my can could will ' +
		'would should may might must do does did done have has had not no yes so than too very just ' +
		'about into over under also more most such only own same other any each few some what which ' +
		'who whom how when where why all both there here up down out off again further once use using'
	).split(' '),
);

const stripDiacritics = (value: string): string =>
	value
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/đ/g, 'd')
		.replace(/Đ/g, 'D');

/** Gốc từ rất thô cho tiếng Anh: đủ để "branches" khớp "branch", "merging" khớp "merge". */
const stem = (word: string): string => {
	if (word.length <= 4) return word;
	if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
	if (word.endsWith('ing') && word.length > 6) return word.slice(0, -3);
	if (word.endsWith('ed') && word.length > 5) return word.slice(0, -2);
	if (word.endsWith('es') && /(ch|sh|x|ss)es$/.test(word))
		return word.slice(0, -2);
	if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
	return word;
};

export const tokenize = (text: string): string[] =>
	stripDiacritics(text.toLowerCase())
		.split(/[^a-z0-9]+/)
		.filter((word) => word.length > 1 && !STOPWORDS.has(word))
		.map(stem);

/** Bỏ phần trình bày không mang nghĩa: URL ảnh, thẻ HTML, ký hiệu markdown thừa. */
const cleanMarkdown = (markdown: string): string =>
	markdown
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '[Hình: $1]')
		.replace(/<\/?(div|span|details|summary)[^>]*>/gi, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

/** HTML do TipTap sinh ra → markdown gần đúng, đủ để cắt đoạn theo heading và tìm kiếm. */
const htmlToMarkdown = (html: string): string =>
	html
		.replace(/<h1[^>]*>(.*?)<\/h1>/gis, '\n# $1\n')
		.replace(/<h2[^>]*>(.*?)<\/h2>/gis, '\n## $1\n')
		.replace(/<h3[^>]*>(.*?)<\/h3>/gis, '\n### $1\n')
		.replace(/<li[^>]*>/gi, '\n- ')
		.replace(/<\/(p|div|li|tr|pre|blockquote)>/gi, '\n\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"');

interface Block {
	heading: string[];
	text: string;
}

/** Cắt markdown thành các khối theo heading `##`/`###`, bỏ qua `#` nằm trong khối code. */
const splitByHeadings = (markdown: string): Block[] => {
	const blocks: Block[] = [];
	let path: string[] = [];
	let buffer: string[] = [];
	let inFence = false;
	const flush = () => {
		const text = buffer.join('\n').trim();
		if (text) blocks.push({ heading: path, text });
		buffer = [];
	};
	for (const line of markdown.split(/\r?\n/)) {
		if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
		const match = !inFence && line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
		if (match) {
			flush();
			const level = match[1].length;
			// H1 là tiêu đề cả trang, không đưa vào đường heading của từng đoạn.
			path = level === 1 ? [] : [...path.slice(0, level - 2), match[2]];
			continue;
		}
		buffer.push(line);
	}
	flush();
	return blocks;
};

/** Khối dài thì cắt tiếp theo đoạn văn (dòng trống), giữ nguyên khối code. */
const splitLongBlock = (text: string): string[] => {
	if (text.length <= CHUNK_MAX) return [text];
	const parts: string[] = [];
	let current = '';
	for (const paragraph of text.split(/\n\s*\n/)) {
		if (current && current.length + paragraph.length > CHUNK_TARGET) {
			parts.push(current.trim());
			current = '';
		}
		current += `${paragraph}\n\n`;
	}
	if (current.trim()) parts.push(current.trim());
	return parts;
};

const firstUrl = (value: string | null): string | null =>
	value?.match(/https?:\/\/[^\s)"']+/)?.[0] ?? null;

@Injectable()
export class TutorKnowledgeService {
	private readonly cache = new Map<string, CourseIndex>();

	constructor(
		@InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
	) {}

	async getIndex(courseId: string): Promise<CourseIndex> {
		const rows = await this.lessons
			.createQueryBuilder('lesson')
			.innerJoin('lesson.section', 'section')
			.select([
				'lesson.id',
				'lesson.title',
				'lesson.summary',
				'lesson.content',
				'lesson.contentFormat',
				'lesson.catalogKey',
				'lesson.orderIndex',
				'lesson.updatedAt',
			])
			.addSelect(['section.id', 'section.title', 'section.orderIndex'])
			.where('lesson.courseId = :courseId', { courseId })
			.andWhere('lesson.isPublished = true')
			.andWhere('lesson.deletedAt IS NULL')
			.andWhere('section.isPublished = true')
			.orderBy('section.orderIndex', 'ASC')
			.addOrderBy('lesson.orderIndex', 'ASC')
			.getMany();

		const version = `${rows.length}:${Math.max(0, ...rows.map((row) => row.updatedAt.getTime()))}`;
		const cached = this.cache.get(courseId);
		if (cached?.version === version) return cached;

		const index = this.build(rows, version);
		this.cache.set(courseId, index);
		return index;
	}

	private build(rows: Lesson[], version: string): CourseIndex {
		const lessons: KnowledgeLesson[] = [];
		const chunks: KnowledgeChunk[] = [];
		const sectionNumbers = new Map<string, number>();
		const lessonCounters = new Map<string, number>();

		for (const row of rows) {
			const section = (
				row as Lesson & { section: { id: string; title: string } }
			).section;
			if (!sectionNumbers.has(section.id))
				sectionNumbers.set(section.id, sectionNumbers.size + 1);
			const lessonNumber = (lessonCounters.get(section.id) ?? 0) + 1;
			lessonCounters.set(section.id, lessonNumber);
			const key = `${sectionNumbers.get(section.id)}.${lessonNumber}`;

			const raw = row.content ?? '';
			const markdown = cleanMarkdown(
				row.contentFormat === 'markdown' ? raw : htmlToMarkdown(raw),
			);
			const originalTitle = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;

			let count = 0;
			for (const block of splitByHeadings(markdown)) {
				const heading = block.heading.join(' › ');
				for (const text of splitLongBlock(block.text)) {
					count += 1;
					chunks.push({
						id: `${key}#${count}`,
						lessonKey: key,
						lessonId: row.id,
						lessonTitle: row.title,
						heading,
						text,
						// Tiêu đề bài và heading lặp lại để được trọng số cao hơn thân đoạn.
						tokens: tokenize(
							`${row.title} ${originalTitle ?? ''} ${heading} ${heading} ${text}`,
						),
					});
				}
			}

			lessons.push({
				key,
				lessonId: row.id,
				title: row.title,
				sectionTitle: section.title,
				originalTitle,
				sourceUrl: firstUrl(row.summary),
				chunkCount: count,
				empty: count === 0,
				generatable: count === 0 && Boolean(row.catalogKey),
			});
		}

		const docFreq = new Map<string, number>();
		for (const chunk of chunks) {
			for (const token of new Set(chunk.tokens))
				docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
		}
		const avgLength =
			chunks.reduce((sum, chunk) => sum + chunk.tokens.length, 0) /
			Math.max(1, chunks.length);

		return {
			version,
			lessons,
			chunks,
			byId: new Map(chunks.map((chunk) => [chunk.id, chunk])),
			docFreq,
			avgLength,
		};
	}

	/** Mã các bài chưa có nội dung, theo thứ tự mục lục. */
	emptyLessonKeys(index: CourseIndex): string[] {
		return index.lessons.filter((lesson) => lesson.empty).map((l) => l.key);
	}

	/** BM25 (k1 = 1.2, b = 0.75) + điểm cộng khi cả cụm từ xuất hiện nguyên văn. */
	search(
		index: CourseIndex,
		query: string,
		options: { lessonKey?: string; limit: number },
	): SearchHit[] {
		const terms = [...new Set(tokenize(query))];
		if (!terms.length) return [];
		const phrase = stripDiacritics(query.toLowerCase()).trim();
		const total = index.chunks.length;
		const k1 = 1.2;
		const b = 0.75;

		const hits: SearchHit[] = [];
		for (const chunk of index.chunks) {
			if (options.lessonKey && chunk.lessonKey !== options.lessonKey) continue;
			const frequencies = new Map<string, number>();
			for (const token of chunk.tokens)
				frequencies.set(token, (frequencies.get(token) ?? 0) + 1);

			let score = 0;
			for (const term of terms) {
				const tf = frequencies.get(term);
				if (!tf) continue;
				const df = index.docFreq.get(term) ?? 0;
				const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
				score +=
					(idf * tf * (k1 + 1)) /
					(tf + k1 * (1 - b + (b * chunk.tokens.length) / index.avgLength));
			}
			if (
				score > 0 &&
				phrase.length > 3 &&
				stripDiacritics(chunk.text.toLowerCase()).includes(phrase)
			)
				score *= 1.5;
			if (score > 0) hits.push({ chunk, score });
		}
		return hits.sort((a, b2) => b2.score - a.score).slice(0, options.limit);
	}
}
