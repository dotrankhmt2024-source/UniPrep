import { Form, Input, type FormItemProps, type InputProps } from 'antd';
import type { Rule } from 'antd/es/form';
import type { ReactNode } from 'react';

/**
 * Shared form field wrapper. Always use this (inside an antd `<Form>`) instead of writing
 * `<label>` + `<input>` by hand in a page.
 *
 * Two ways to use it:
 *
 * 1. Plain text input — just pass `formItemProps` (+ optional `rules`/`inputProps`):
 *    `<FormItem formItemProps={{ label: 'Mã môn', name: 'code' }} rules={[{ required: true }]} />`
 *
 * 2. Any other control — pass children and they are rendered as the field control:
 *    `<FormItem formItemProps={{ label: 'Số tín chỉ', name: 'credits' }}><Select ... /></FormItem>`
 */
export interface IFormItemProps {
	formItemProps?: FormItemProps;
	inputProps?: InputProps;
	rules?: Rule[];
	children?: ReactNode;
}

const { Item } = Form;

const FormItem = ({ rules, inputProps, formItemProps, children }: IFormItemProps) => {
	return (
		<Item
			validateDebounce={rules ? 500 : undefined}
			rules={rules}
			{...formItemProps}
		>
			{children ?? <Input size="large" {...inputProps} />}
		</Item>
	);
};

export default FormItem;
