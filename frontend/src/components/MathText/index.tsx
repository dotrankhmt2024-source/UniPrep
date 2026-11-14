import { useMemo } from 'react';
import { hasMath, renderTextWithMath } from '@/utils/math';

export interface MathTextProps {
	/** Văn bản thuần, có thể chứa công thức `$…$`, `\(…\)`, `$$…$$`, `\[…\]`. */
	text: string | null | undefined;
	className?: string;
}

/**
 * Văn bản một dòng/đoạn ngắn có công thức (câu hỏi, phương án, lời giải trắc nghiệm).
 *
 * Không có công thức thì render chữ như bình thường; có công thức thì phần chữ được escape và
 * công thức render bằng KaTeX (`utils/math`).
 */
const MathText = ({ text, className }: MathTextProps) => {
	const html = useMemo(
		() => (hasMath(text) ? renderTextWithMath(text) : null),
		[text],
	);

	if (html === null) return <span className={className}>{text}</span>;
	return (
		<span className={className} dangerouslySetInnerHTML={{ __html: html }} />
	);
};

export default MathText;
