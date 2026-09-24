import type { ReactNode } from 'react';

/**
 * Shared status badge / pill used across the whole repo.
 * Use `status="error"` (or `status="error"` + `dot`) to surface validation or API errors in a page.
 * Prefer this component over ad-hoc `<span className="... rounded-full">` markup in pages.
 */
export type BadgeStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'processing';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
	/** Semantic colour of the badge. `error` is the canonical way to render an error state. */
	status?: BadgeStatus;
	/** Optional leading icon, usually a `<MaterialIcon />` or an `@ant-design/icons` node. */
	icon?: ReactNode;
	/** Show a small coloured dot before the label. */
	dot?: boolean;
	/** Size of the badge. Defaults to `sm`. */
	size?: BadgeSize;
	/** Adds an uppercase + letter-spacing look, handy for table status columns. */
	uppercase?: boolean;
	className?: string;
	title?: string;
	children?: ReactNode;
}

const STATUS_CLASS: Record<BadgeStatus, string> = {
	success: 'bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]',
	warning: 'bg-[#fffbeb] text-[#92400e] border-[#fde68a]',
	error: 'bg-error-container text-on-error-container border-error/30',
	info: 'bg-surface-container-low text-secondary border-secondary/30',
	neutral: 'bg-surface-container text-on-surface-variant border-outline-variant',
	processing: 'bg-surface-container-low text-secondary border-secondary/40',
};

const DOT_CLASS: Record<BadgeStatus, string> = {
	success: 'bg-[#059669]',
	warning: 'bg-[#d97706]',
	error: 'bg-error',
	info: 'bg-secondary',
	neutral: 'bg-outline',
	processing: 'bg-secondary animate-pulse',
};

const SIZE_CLASS: Record<BadgeSize, string> = {
	sm: 'px-2 py-0.5 text-label-sm font-label-sm gap-1',
	md: 'px-2.5 py-1 text-label-md font-label-md gap-1.5',
};

const Badge = ({
	status = 'neutral',
	icon,
	dot = false,
	size = 'sm',
	uppercase = false,
	className,
	title,
	children,
}: BadgeProps) => {
	const mergedClassName = [
		'inline-flex items-center rounded-full border font-semibold whitespace-nowrap',
		STATUS_CLASS[status],
		SIZE_CLASS[size],
		uppercase ? 'uppercase tracking-wider' : '',
		className || '',
	]
		.join(' ')
		.trim();

	return (
		<span className={mergedClassName} title={title} data-status={status}>
			{dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_CLASS[status]}`} />}
			{icon}
			{children}
		</span>
	);
};

/** Convenience wrapper: a badge that always renders the `error` status. */
export const ErrorBadge = (props: Omit<BadgeProps, 'status'>) => <Badge status="error" {...props} />;

export default Badge;
