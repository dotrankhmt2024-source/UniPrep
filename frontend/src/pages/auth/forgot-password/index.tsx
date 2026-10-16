import { useState } from 'react';
import { Form } from 'antd';
import { Link } from 'react-router';
import { ErrorBadge, FormItem, ISolidBtn, Icon } from '@/components';
import { forgotPassword } from '@/apis/auth';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';

interface ForgotPasswordFormValues {
	email: string;
}

/**
 * Trang "Quên mật khẩu".
 *
 * Bảo mật: dù email có tồn tại hay không, backend luôn trả cùng một message trung tính
 * (`AUTH_MESSAGE.forgotPasswordNeutral`) — trang chỉ hiển thị đúng message đó và KHÔNG
 * suy diễn gì thêm, để không biến form này thành công cụ dò email.
 */
const ForgotPasswordPage = () => {
	const [form] = Form.useForm<ForgotPasswordFormValues>();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');

	const handleSubmit = async (values: ForgotPasswordFormValues) => {
		setIsSubmitting(true);
		setErrorMessage('');
		setSuccessMessage('');

		try {
			const response = await forgotPassword({ email: values.email.trim() });
			setSuccessMessage(
				response.message ||
					'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.',
			);
		} catch (error) {
			setErrorMessage(
				getApiErrorMessage(error, 'Không gửi được yêu cầu, vui lòng thử lại.'),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-space-lg">
			<div className="space-y-space-xs text-center">
				<h2 className="font-headline-md font-headline-md font-bold text-on-surface">
					Quên mật khẩu
				</h2>
				<p className="font-body-sm font-body-sm text-on-surface-variant">
					Nhập email đã đăng ký, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.
				</p>
			</div>

			{errorMessage && <ErrorBadge>{errorMessage}</ErrorBadge>}

			{successMessage && (
				<div className="flex items-start gap-space-sm rounded-xl border border-secondary/30 bg-surface-container-low p-space-md">
					<Icon
						name="mark_email_read"
						size={20}
						className="mt-0.5 shrink-0 text-secondary"
					/>
					<p className="font-body-sm font-body-sm text-on-surface">
						{successMessage}
					</p>
				</div>
			)}

			<Form<ForgotPasswordFormValues>
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

				<ISolidBtn
					type="primary"
					htmlType="submit"
					size="large"
					block
					loading={isSubmitting}
				>
					Gửi liên kết
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

export default ForgotPasswordPage;
