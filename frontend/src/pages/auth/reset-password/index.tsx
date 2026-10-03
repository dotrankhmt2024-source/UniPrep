import { useState } from 'react';
import { Form, message } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
	ConfirmPassword,
	ErrorBadge,
	ISolidBtn,
	PasswordInput,
} from '@/components';
import { resetPassword } from '@/apis/auth';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';

interface ResetPasswordFormValues {
	password: string;
	confirmPassword: string;
}

/**
 * Trang "Đặt lại mật khẩu" — token một lần lấy từ `?token=` trên URL (link trong email).
 *
 * Thiếu token thì không gọi API làm gì: hiển thị lỗi và lối về trang quên mật khẩu.
 */
const ResetPasswordPage = () => {
	const [form] = Form.useForm<ResetPasswordFormValues>();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const token = searchParams.get('token') ?? '';
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');

	const handleSubmit = async (values: ResetPasswordFormValues) => {
		setIsSubmitting(true);
		setErrorMessage('');

		try {
			await resetPassword({ token, password: values.password });
			message.success('Đặt lại mật khẩu thành công, vui lòng đăng nhập lại.');
			navigate('/login', { replace: true });
		} catch (error) {
			// 400/401: token sai hoặc hết hạn — hiển thị nguyên văn message tiếng Việt của API.
			setErrorMessage(
				getApiErrorMessage(
					error,
					'Đặt lại mật khẩu thất bại, vui lòng thử lại.',
				),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!token) {
		return (
			<div className="space-y-space-lg">
				<div className="space-y-space-xs text-center">
					<h2 className="font-headline-md font-headline-md font-bold text-on-surface">
						Đặt lại mật khẩu
					</h2>
				</div>

				<ErrorBadge>
					Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu
					cầu liên kết mới.
				</ErrorBadge>

				<Link
					to="/forgot-password"
					className="block text-center font-label-md font-label-md text-secondary hover:underline"
				>
					Gửi lại liên kết đặt lại mật khẩu
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-space-lg">
			<div className="space-y-space-xs text-center">
				<h2 className="font-headline-md font-headline-md font-bold text-on-surface">
					Đặt lại mật khẩu
				</h2>
				<p className="font-body-sm font-body-sm text-on-surface-variant">
					Nhập mật khẩu mới cho tài khoản của bạn.
				</p>
			</div>

			{errorMessage && <ErrorBadge>{errorMessage}</ErrorBadge>}

			<Form<ResetPasswordFormValues>
				form={form}
				layout="vertical"
				requiredMark={false}
				onFinish={handleSubmit}
			>
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
					Đặt lại mật khẩu
				</ISolidBtn>
			</Form>

			<p className="text-center font-body-sm font-body-sm text-on-surface-variant">
				<Link
					to="/login"
					className="font-label-md font-label-md text-secondary hover:underline"
				>
					Quay lại đăng nhập
				</Link>
			</p>
		</div>
	);
};

export default ResetPasswordPage;
