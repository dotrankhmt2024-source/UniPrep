import { Button, type ButtonProps } from 'antd';

/**
 * Borderless icon-only button — table row actions, header actions, close buttons, …
 * Pass the icon through the `icon` prop and add `title` for the tooltip/accessibility label.
 */
const IconBtn = ({ className, icon, ...restProps }: ButtonProps) => {
	return (
		<Button
			color="default"
			variant="text"
			shape="square"
			icon={icon}
			className={className}
			{...restProps}
		/>
	);
};

export default IconBtn;
