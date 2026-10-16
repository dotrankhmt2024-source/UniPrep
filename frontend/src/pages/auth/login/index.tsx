import { useState } from 'react';
import { DownloadOutlined } from '@ant-design/icons';
import { Form, message } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ErrorBadge, FormItem, ISolidBtn, PasswordInput } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import { useAuth } from '@/contexts/auth-context';
import { resolveRedirect } from '@/utils/auth';
import type { LoginPayload } from '@/types';

type LoginFormValues = LoginPayload;

const LoginPage = () => {
	const [form] = Form.useForm<LoginFormValues>();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { login } = useAuth();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');

	const handleSubmit = async (values: LoginFormValues) => {
		setIsSubmitting(true);
		setErrorMessage('');

		try {
			const session = await login({
				email: values.email.trim(),
				password: values.password,
			});
			if (!session) {
				setErrorMessage('Đăng nhập thất bại, vui lòng thử lại.');
				return;
			}

			message.success('Đăng nhập thành công');
			navigate(resolveRedirect(searchParams.get('redirect')), {
				replace: true,
			});
		} catch (error) {
			// Hiển thị đúng message tiếng Việt backend trả về (401: "Email hoặc mật khẩu không đúng.").
			setErrorMessage(
				getApiErrorMessage(error, 'Đăng nhập thất bại, vui lòng thử lại.'),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-space-lg">
			<div className="space-y-space-xs text-center">
				<h2 className="font-headline-md font-headline-md font-bold text-on-surface">
					Đăng nhập
				</h2>
				<p className="font-body-sm font-body-sm text-on-surface-variant">
					Sử dụng email đã đăng ký để truy cập UniPrep.
				</p>
			</div>

			{errorMessage && <ErrorBadge>{errorMessage}</ErrorBadge>}

			<Form<LoginFormValues>
				form={form}
				layout="vertical"
				requiredMark={false}
				onFinish={handleSubmit}
			>
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
					autoComplete="current-password"
					placeholder="Nhập mật khẩu"
				/>

				<div className="mb-space-md flex justify-end">
					<Link
						to="/forgot-password"
						className="font-label-md font-label-md text-secondary hover:underline"
					>
						Quên mật khẩu?
					</Link>
				</div>

				<ISolidBtn
					type="primary"
					htmlType="submit"
					size="large"
					style={{ height: 52, padding: '0 24px' }}
					block
					loading={isSubmitting}
				>
					Đăng nhập
				</ISolidBtn>
			</Form>

			<ISolidBtn
				href="/testing_guild.md"
				download="UniPrep-testing-guide.md"
				icon={<DownloadOutlined />}
				size="large"
				style={{ height: 52, marginTop: 12, padding: '0 24px' }}
				block
			>
				Tải hướng dẫn cho tester
			</ISolidBtn>

			<p className="text-center font-body-sm font-body-sm text-on-surface-variant">
				Chưa có tài khoản?{' '}
				<Link
					to="/register"
					className="font-label-md font-label-md text-secondary hover:underline"
				>
					Đăng ký
				</Link>
			</p>
		</div>
	);
};

export default LoginPage;
