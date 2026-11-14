import { marked } from 'marked';
import { sanitizeHtml } from './html';

/**
 * Markdown → HTML **đã làm sạch**, dùng cho bài học có `contentFormat = 'markdown'` và câu trả lời
 * của trợ giảng AI.
 *
 * `marked` không lọc HTML nhúng trong markdown (markdown cho phép gõ thẳng thẻ HTML), nên kết quả
 * bắt buộc đi qua `sanitizeHtml` — cùng chốt chặn XSS với nội dung TipTap.
 *
 * Cú pháp cảnh báo của GitHub (`> [!NOTE]`, `> [!WARNING]`…) không phải markdown chuẩn; đổi thành
 * nhãn in đậm để blockquote vẫn đọc được thay vì hiện nguyên `[!NOTE]`.
 */
const ALERT_LABEL: Record<string, string> = {
	NOTE: 'Ghi chú',
	TIP: 'Mẹo',
	IMPORTANT: 'Quan trọng',
	WARNING: 'Cảnh báo',
	CAUTION: 'Thận trọng',
};

const replaceAlerts = (markdown: string): string =>
	markdown.replace(
		/^(\s*>\s*)\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/gm,
		(_, prefix: string, kind: string) => `${prefix}**${ALERT_LABEL[kind]}:**`,
	);

export const renderMarkdown = (markdown: string | null | undefined): string => {
	if (!markdown) return '';
	const html = marked.parse(replaceAlerts(markdown), {
		async: false,
		gfm: true,
		breaks: false,
	});

	return sanitizeHtml(html);
};
