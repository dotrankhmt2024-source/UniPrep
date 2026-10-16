/**
 * Message nghiệp vụ của `UserModule` (E2) — đối chiếu `docs/02-specs/api-specification.md` §5.4.
 * Tập trung một chỗ để controller/service không tự viết chuỗi, và để FE thấy đúng câu tiếng Việt.
 */
export const USER_MESSAGE = {
	profileUpdated: 'Cập nhật hồ sơ thành công',
	statusUpdated: 'Cập nhật trạng thái tài khoản thành công',
	roleUpdated: 'Cập nhật vai trò thành công',

	selfStatusChange:
		'Bạn không thể khoá hoặc vô hiệu hoá tài khoản của chính mình.',
	/** Giữ hệ thống luôn còn ít nhất một admin đang hoạt động (E2-T2 DoD). */
	selfRoleDemotion: 'Bạn không thể tự hạ vai trò quản trị viên của chính mình.',
} as const;
