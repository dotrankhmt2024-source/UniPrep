import { useState } from 'react';
import { Form, message } from 'antd';
import { Link, useNavigate } from 'react-router';
import {
	ConfirmPassword,
	ErrorBadge,
	FormItem,
	ISolidBtn,
	PasswordInput,
} from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import { useAuth } from '@/contexts/auth-context';
import { isEmailTakenError } from '@/utils/auth';

interface RegisterFormValues {
	fullName: string;
	email: string;
	password: string;
	confirmPassword: string;
}

const RegisterPage = () => {
	const [form] = Form.useForm<RegisterFormValues>();
	const navigate = useNavigate();
	const { register } = useAuth();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');

	const handleSubmit = async (values: RegisterFormValues) => {
		setIsSubmitting(true);
		setErrorMessage('');

		try {
			const session = await register({
				fullName: values.fullName.trim(),
				email: values.email.trim(),
				password: values.password,
			});

			if (!session) {
				setErrorMessage('Đăng ký thất bại, vui lòng thử lại.');
				return;
			}

			message.success('Đăng ký thành công');
			navigate('/', { replace: true });
		} catch (error) {
			const apiMessage = getApiErrorMessage(
				error,
				'Đăng ký thất bại, vui lòng thử lại.',
			);

			// 409 = email đã được sử dụng ⇒ lỗi thuộc về field email, không phải lỗi chung của form.
			if (isEmailTakenError(error)) {
				form.setFields([{ name: 'email', errors: [apiMessage] }]);
				return;
			}

			setErrorMessage(apiMessage);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-space-lg">
			<div className="space-y-space-xs text-center">
				<h2 className="font-headline-md font-headline-md font-bold text-on-surface">
					Đăng ký tài khoản
				</h2>
				<p className="font-body-sm font-body-sm text-on-surface-variant">
					Tạo tài khoản học viên để bắt đầu sử dụng UniPrep.
				</p>
			</div>

			{errorMessage && <ErrorBadge>{errorMessage}</ErrorBadge>}

			<Form<RegisterFormValues>
				form={form}
				layout="vertical"
				requiredMark={false}
				onFinish={handleSubmit}
			>
				<FormItem
					formItemProps={{ label: 'Họ và tên', name: 'fullName' }}
					inputProps={{
						placeholder: 'Nguyễn Văn An',
						autoComplete: 'name',
						size: 'large',
					}}
					rules={[{ required: true, message: 'Họ và tên không được để trống' }]}
				/>

				<FormItem
					formItemProps={{ label: 'Email', name: 'email' }}
					inputProps={{
						placeholder: 'ten@example.com',
						autoComplete: 'email',
						size: 'large',
					}}
					rules={[
						{ required: true, message: 'Email không được để trống' },
						{ type: 'email', message: 'Email không hợp lệ' },
					]}
				/>

				<PasswordInput
					autoComplete="new-password"
					placeholder="Từ 8 đến 16 ký tự"
				/>

				<ConfirmPassword
					form={form}
					autoComplete="new-password"
					placeholder="Nhập lại mật khẩu"
				/>

				<ISolidBtn
					type="primary"
					htmlType="submit"
					size="large"
					block
					loading={isSubmitting}
				>
					Đăng ký
				</ISolidBtn>
			</Form>

			<p className="text-center font-body-sm font-body-sm text-on-surface-variant">
				Đã có tài khoản?{' '}
				<Link
					to="/login"
					className="font-label-md font-label-md text-secondary hover:underline"
				>
					Đăng nhập
				</Link>
			</p>
		</div>
	);
};

export default RegisterPage;
