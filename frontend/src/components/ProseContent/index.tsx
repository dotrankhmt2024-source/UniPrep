import { useMemo } from 'react';
import { sanitizeHtml } from '@/utils/html';
import { renderMarkdown } from '@/utils/markdown';

export interface ProseContentProps {
	/** Nội dung thô: markdown hoặc HTML (TipTap). */
	content: string | null | undefined;
	/** `markdown` → render qua `marked`; mọi giá trị khác coi là HTML. Cả hai đều qua `sanitizeHtml`. */
	format?: 'markdown' | 'html' | 'tiptap_json';
	/** `sm` cho bong bóng chat (chữ và khoảng cách nhỏ hơn). */
	size?: 'md' | 'sm';
	className?: string;
}

/**
 * Typography cho nội dung chèn bằng chuỗi HTML (bài học, câu trả lời của trợ giảng AI).
 *
 * `[&_...]` của Tailwind 4 đặt style cho các thẻ con vì nội dung không phải JSX nên không gắn class
 * trực tiếp cho từng thẻ được. Đây là **chốt chặn XSS**: mọi định dạng đều đi qua `sanitizeHtml`
 * trước `dangerouslySetInnerHTML`.
 */
const BASE =
	'text-on-surface [&_a]:text-secondary [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-outline-variant [&_blockquote]:pl-4 [&_blockquote]:text-on-surface-variant [&_code]:rounded [&_code]:bg-surface-container [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-headline-sm [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-title-lg [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-title-md [&_h3]:font-semibold [&_h4]:mb-2 [&_h4]:mt-3 [&_h4]:font-semibold [&_hr]:my-5 [&_hr]:border-outline-variant [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-outline-variant [&_li]:mb-1 [&_li>p]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_p]:leading-relaxed [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-container [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:mb-3 [&_table]:w-full [&_td]:border [&_td]:border-outline-variant [&_td]:p-2 [&_th]:border [&_th]:border-outline-variant [&_th]:bg-surface-container-low [&_th]:p-2 [&_th]:text-left [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&>*:last-child]:mb-0';

const SIZE: Record<NonNullable<ProseContentProps['size']>, string> = {
	md: 'font-body-md',
	sm: 'text-body-md [&_h2]:text-title-md [&_h3]:text-title-sm [&_p]:mb-2 [&_pre]:text-[13px]',
};

const ProseContent = ({
	content,
	format = 'html',
	size = 'md',
	className,
}: ProseContentProps) => {
	const html = useMemo(
		() =>
			format === 'markdown' ? renderMarkdown(content) : sanitizeHtml(content),
		[content, format],
	);

	return (
		<div
			className={[BASE, SIZE[size], className].filter(Boolean).join(' ')}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
};

export default ProseContent;
