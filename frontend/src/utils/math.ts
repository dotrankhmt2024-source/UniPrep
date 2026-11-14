import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Công thức LaTeX trong nội dung (bài học AI sinh, câu trả lời trợ giảng, câu hỏi trắc nghiệm).
 *
 * Nhận cả bốn kiểu phân cách model hay dùng: `$$…$$`, `\[…\]` (khối) và `$…$`, `\(…\)` (dòng).
 *
 * Công thức được **tách ra trước** khi đưa văn bản cho `marked`/escape, thay bằng mã giữ chỗ, rồi
 * mới ghép HTML của KaTeX vào sau cùng. Lý do:
 * - `marked` hiểu `_`, `*`, `\` trong công thức là cú pháp markdown và làm hỏng nó;
 * - `sanitizeHtml` (DOMPurify với allowlist) sẽ xoá phần MathML/SVG của KaTeX.
 * HTML ghép vào là do KaTeX sinh từ chuỗi TeX với `trust: false` (không cho `\href`, `\url`,
 * `\htmlClass`…), nên không mở đường XSS mới.
 *
 * Công thức nằm trong code block/inline code được giữ nguyên.
 */

const TOKEN = (index: number) => `KATEXMATH${index}TOKEN`;
const TOKEN_PATTERN = /KATEXMATH(\d+)TOKEN/g;
const CODE_TOKEN = (index: number) => `KATEXCODE${index}TOKEN`;
const CODE_TOKEN_PATTERN = /KATEXCODE(\d+)TOKEN/g;

interface MathSegment {
	tex: string;
	display: boolean;
}

const MATH_PATTERNS: { pattern: RegExp; display: boolean }[] = [
	{ pattern: /\$\$([\s\S]+?)\$\$/g, display: true },
	{ pattern: /\\\[([\s\S]+?)\\\]/g, display: true },
	{ pattern: /\\\(([\s\S]+?)\\\)/g, display: false },
	// `$…$`: không bắt "$5 và $10" — sau `$` mở và trước `$` đóng không được là khoảng trắng,
	// `$` đóng không được theo sau bởi chữ số.
	{
		pattern: /(?<![\\$\w])\$(?![\s$])([^$\n]+?)(?<![\s\\])\$(?![\d$])/g,
		display: false,
	},
];

const renderTex = ({ tex, display }: MathSegment): string =>
	katex.renderToString(tex.trim(), {
		displayMode: display,
		throwOnError: false,
		strict: 'ignore',
		trust: false,
		output: 'htmlAndMathml',
	});

/** Thay công thức bằng mã giữ chỗ; trả văn bản mới và danh sách công thức. */
const extractMath = (
	text: string,
	options: { protectCode: boolean },
): { text: string; segments: MathSegment[] } => {
	const codes: string[] = [];
	let working = text;
	if (options.protectCode) {
		working = working.replace(/(```|~~~)[\s\S]*?\1|`[^`\n]+`/g, (match) => {
			codes.push(match);
			return CODE_TOKEN(codes.length - 1);
		});
	}

	const segments: MathSegment[] = [];
	for (const { pattern, display } of MATH_PATTERNS) {
		working = working.replace(pattern, (_match, tex: string) => {
			segments.push({ tex, display });
			const token = TOKEN(segments.length - 1);
			// Công thức khối đứng thành đoạn riêng để markdown không nhét nó vào giữa câu.
			return display && options.protectCode ? `\n\n${token}\n\n` : token;
		});
	}

	if (codes.length) {
		working = working.replace(
			CODE_TOKEN_PATTERN,
			(_match, index: string) => codes[Number(index)] ?? '',
		);
	}
	return { text: working, segments };
};

const restoreMath = (html: string, segments: MathSegment[]): string =>
	segments.length
		? html.replace(TOKEN_PATTERN, (match, index: string) => {
				const segment = segments[Number(index)];
				return segment ? renderTex(segment) : match;
			})
		: html;

/**
 * Dùng cho markdown: `render` nhận văn bản đã thay công thức (vd `marked` + `sanitizeHtml`), kết
 * quả được ghép lại công thức đã render.
 */
export const renderMarkdownWithMath = (
	markdown: string,
	render: (markdownWithoutMath: string) => string,
): string => {
	const { text, segments } = extractMath(markdown, { protectCode: true });
	return restoreMath(render(text), segments);
};

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

/** Văn bản thuần có thể chứa công thức → HTML an toàn (phần chữ được escape). */
export const renderTextWithMath = (text: string | null | undefined): string => {
	if (!text) return '';
	const { text: withTokens, segments } = extractMath(text, {
		protectCode: false,
	});
	return restoreMath(escapeHtml(withTokens), segments);
};

/** Có công thức nào không — để chỗ hiển thị chữ thuần khỏi tốn công render. */
export const hasMath = (text: string | null | undefined): boolean =>
	!!text &&
	MATH_PATTERNS.some(({ pattern }) => {
		pattern.lastIndex = 0;
		const found = pattern.test(text);
		pattern.lastIndex = 0;
		return found;
	});
