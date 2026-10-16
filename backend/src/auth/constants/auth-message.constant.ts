import { LOGIN_LOCKOUT_MINUTES } from './auth.constant';

/**
 * Message nghiệp vụ của luồng xác thực — đối chiếu `docs/02-specs/api-specification.md` §5.3.
 * Tách khỏi `common/constants/http-message.constant.ts` vì đây là câu **cụ thể cho auth**, còn file
 * kia là fallback theo HTTP status dùng chung cho toàn API.
 */
export const AUTH_MESSAGE = {
	registerSuccess: 'Đăng ký thành công',
	loginSuccess: 'Đăng nhập thành công',
	logoutSuccess: 'Đăng xuất thành công',
	resetPasswordSuccess: 'Đặt lại mật khẩu thành công',
	changePasswordSuccess: 'Đổi mật khẩu thành công, vui lòng đăng nhập lại.',

	invalidCredentials: 'Email hoặc mật khẩu không đúng.',
	emailTaken: 'Email này đã được sử dụng.',
	studentCodeTaken: 'Mã số sinh viên này đã được sử dụng.',

	accountLocked: `Tài khoản của bạn đang bị tạm khoá ${LOGIN_LOCKOUT_MINUTES} phút do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.`,

	invalidSession: 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.',
	invalidResetToken: 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
	forgotPasswordNeutral:
		'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.',
	wrongCurrentPassword: 'Mật khẩu hiện tại không đúng.',
	samePassword: 'Mật khẩu mới không được trùng mật khẩu cũ.',

	userNotFound: 'Không tìm thấy người dùng.',
} as const;
