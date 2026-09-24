import { Button, type ButtonProps } from 'antd';
import type { CSSProperties } from 'react';
import { BRAND } from '@/config/antd-theme';

/**
 * Solid (filled) button — the primary call-to-action across the repo.
 *
 * - `default` → M3 "secondary" blue, the everyday primary action
 * - `primary` → M3 "primary-container" navy, used for the strongest CTA (e.g. Đăng ký / Lưu & Xuất bản)
 * - `error`   → destructive action
 *
 * Do NOT hand-roll `<button className="...">` in pages; use this component instead.
 */
export interface ISolidBtnProps extends ButtonProps {
	background?: 'default' | 'primary' | 'error';
}

const SOLID_PRESET: Record<
	NonNullable<ISolidBtnProps['background']>,
	{ color: ButtonProps['color']; variant: ButtonProps['variant']; style?: CSSProperties }
> = {
	default: { color: 'primary', variant: 'solid' },
	primary: {
		color: 'primary',
		variant: 'solid',
		// Inline root style beats antd's generated CSS, so no `!important` class fight is needed.
		style: { backgroundColor: BRAND.navy, borderColor: BRAND.navy, color: '#ffffff' },
	},
	error: { color: 'danger', variant: 'solid' },
};

const ISolidBtn = ({ children, background = 'default', className, style, ...restProps }: ISolidBtnProps) => {
	const preset = SOLID_PRESET[background];

	return (
		<Button
			color={preset.color}
			variant={preset.variant}
			className={['font-label-lg', className || ''].join(' ').trim()}
			style={{ ...preset.style, ...style }}
			{...restProps}
		>
			{children}
		</Button>
	);
};

export default ISolidBtn;
