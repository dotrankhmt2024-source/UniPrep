import { Form, Input, type FormInstance, type FormItemProps, type InputProps } from 'antd';

/**
 * Shared "Xác nhận mật khẩu" field. Needs the surrounding `<Form>` instance so it can compare
 * against the `password` field. Render it next to `<PasswordInput />`.
 */
export interface ConfirmPasswordProps extends Omit<InputProps, 'form'> {
	formItemProps?: FormItemProps;
	form: FormInstance;
	/** Field the confirmation is compared against. Defaults to `password`. */
	compareFieldName?: string;
}

const ConfirmPassword = ({ formItemProps, form, compareFieldName = 'password', ...restProps }: ConfirmPasswordProps) => {
	return (
		<Form.Item
			label="Xác nhận mật khẩu"
			name="confirmPassword"
			rules={[
				{ required: true, message: 'Xác nhận mật khẩu không được để trống' },
				{
					validator: (_, value) => {
						if (value === undefined || value === null) return Promise.reject();
						if (form.getFieldValue(compareFieldName) !== value) {
							return Promise.reject(new Error('Xác nhận mật khẩu chưa chính xác!'));
						}
						return Promise.resolve();
					},
				},
			]}
			validateDebounce={500}
			{...formItemProps}
		>
			<Input.Password size="large" autoComplete="new-password" {...restProps} />
		</Form.Item>
	);
};

export default ConfirmPassword;
