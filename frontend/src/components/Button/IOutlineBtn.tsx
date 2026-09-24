import { Button, type ButtonProps } from 'antd';

/**
 * Outlined (secondary) button — used for every non-primary action in the repo.
 *
 * - `default` → neutral border, for "Tải PDF", "Hủy bỏ", …
 * - `primary` → brand-coloured outline, for "Xem lại bài", "Lưu bản nháp", …
 * - `error`   → destructive outline
 *
 * Do NOT hand-roll `<button className="... border ...">` in pages; use this component instead.
 */
export interface IOutLinedBtnProps extends ButtonProps {
	mode?: 'default' | 'primary' | 'error';
}

const OUTLINED_PRESET: Record<NonNullable<IOutLinedBtnProps['mode']>, Pick<ButtonProps, 'color' | 'variant'>> = {
	default: { color: 'default', variant: 'outlined' },
	primary: { color: 'primary', variant: 'outlined' },
	error: { color: 'danger', variant: 'outlined' },
};

const IOutLinedBtn = ({ children, mode = 'default', className, ...restProps }: IOutLinedBtnProps) => {
	const preset = OUTLINED_PRESET[mode];

	return (
		<Button
			{...preset}
			className={['font-label-lg', className || ''].join(' ').trim()}
			{...restProps}
		>
			{children}
		</Button>
	);
};

export default IOutLinedBtn;
