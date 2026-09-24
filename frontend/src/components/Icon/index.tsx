import type { CSSProperties } from 'react';

/**
 * Shared wrapper for the Material Symbols icon font used by the design system.
 * Prefer this over repeating `<span className="material-symbols-outlined">…</span>` in pages.
 */
export interface IconProps {
	/** Material Symbols ligature name, e.g. `school`, `notifications`, `arrow_forward`. */
	name: string;
	/** Font size in px. Defaults to the CSS value (24px). */
	size?: number;
	/** Use the filled variant of the symbol. */
	filled?: boolean;
	className?: string;
	style?: CSSProperties;
	title?: string;
}

const Icon = ({ name, size, filled = false, className, style, title }: IconProps) => (
	<span
		className={['material-symbols-outlined', className || ''].join(' ').trim()}
		style={{
			...(size ? { fontSize: `${size}px` } : {}),
			...(filled ? { fontVariationSettings: "'FILL' 1" } : {}),
			...style,
		}}
		title={title}
		aria-hidden={title ? undefined : true}
	>
		{name}
	</span>
);

export default Icon;
