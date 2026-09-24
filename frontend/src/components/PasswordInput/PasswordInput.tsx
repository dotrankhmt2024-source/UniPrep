import { Form, Input, type FormItemProps, type InputProps } from 'antd';

/**
 * Shared "Mật khẩu" field with the repo-wide password policy (8-16 chars, upper, lower, digit, special).
 * Renders its own `<Form.Item name="password">` — drop it straight inside an antd `<Form>`.
 * Pass `formItemProps` to override `label`/`name`/`tooltip`, etc.
 */
export interface PasswordInputProps extends InputProps {
	formItemProps?: FormItemProps;
}

const PasswordInput = ({ formItemProps, ...restProps }: PasswordInputProps) => {
	return (
		<Form.Item
			label="Mật khẩu"
			name="password"
			rules={[
				{ required: true, message: 'Mật khẩu không được để trống' },
				{
					validator: (_, value) => {
						if (value === undefined || value === null) return Promise.reject();
						if (!/^.{8,16}$/.test(value)) return Promise.reject(new Error('Mật khẩu phải chứa từ 8 đến 16 ký tự!'));
						if (!/(?=.*[A-Z])/.test(value)) return Promise.reject(new Error('Mật khẩu phải chứa chữ viết hoa!'));
						if (!/(?=.*[a-z])/.test(value)) return Promise.reject(new Error('Mật khẩu phải chứa chữ viết thường!'));
						if (!/(?=.*\d)/.test(value)) return Promise.reject(new Error('Mật khẩu phải chứa chữ số!'));
						if (!/(?=.*[!@#$%^&*])/.test(value)) return Promise.reject(new Error('Mật khẩu phải chứa ký tự đặc biệt!'));
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

export default PasswordInput;
