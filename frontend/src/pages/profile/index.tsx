import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Form, Input, Spin, message } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router';
import { changePassword } from '@/apis/auth';
import { getMyProfile, updateMyProfile } from '@/apis/user';
import {
	Badge,
	ConfirmPassword,
	ErrorBadge,
	FormItem,
	Icon,
	IOutLinedBtn,
	ISolidBtn,
	PasswordInput,
} from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import { useAuth } from '@/contexts/auth-context';
import { updateUser } from '@/store/auth-slice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { USER_ROLE_LABEL, USER_STATUS_LABEL } from '@/types';
import type {
	ChangePasswordPayload,
	UpdateMyProfilePayload,
	UserDetail,
} from '@/types';
import { setStoredSession } from '@/utils/token-storage';
import { getRoleBadgeTone, getStatusBadgeTone } from '@/utils/user';

/**
 * Trang hồ sơ cá nhân (E2-T4) — mọi vai trò, route `/profile`.
 *
 * Ba khối: thông tin tài khoản (chỉ đọc), hồ sơ sửa được, và đổi mật khẩu.
 *
 * Hai điểm nghiệp vụ quan trọng:
 * 1. `role`/`status`/`email` **không** có trong form vì backend loại bỏ chúng (`whitelist: true`);
 *    đưa vào UI chỉ tạo cảm giác sửa được trong khi request bị bỏ qua.
 * 2. Đổi mật khẩu thành công ⇒ backend thu hồi **mọi** refresh token của người dùng, nên phiên hiện
 *    tại chết ngay: phải dọn phiên rồi đưa về `/login`, không được để lại trạng thái "đã đăng nhập"
 *    nhưng mọi request sau đó đều 401.
 */
interface ProfileFormValues {
	fullName: string;
	phone?: string;
	major?: string;
	bio?: string;
}

interface ChangePasswordFormValues extends ChangePasswordPayload {
	confirmPassword: string;
}

/** Cùng biểu thức với `UpdateMyProfileDto` của backend — sai định dạng thì chặn ngay ở client. */
const PHONE_PATTERN = /^(?:\+84|0)\d{9}$/;

/** Một dòng "nhãn — giá trị" của khối chỉ đọc. */
const InfoRow = ({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) => (
	<div className="flex items-center justify-between gap-space-md">
		<span className="font-label-md font-label-md text-on-surface-variant">
			{label}
		</span>
		<span className="text-right font-body-md font-body-md text-on-surface">
			{children}
		</span>
	</div>
);

const ProfilePage = () => {
	const dispatch = useAppDispatch();
	const navigate = useNavigate();
	const { logout } = useAuth();
	const { accessToken, refreshToken } = useAppSelector((state) => state.auth);
	const [profileForm] = Form.useForm<ProfileFormValues>();
	const [passwordForm] = Form.useForm<ChangePasswordFormValues>();

	const [profile, setProfile] = useState<UserDetail | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState('');
	const [passwordError, setPasswordError] = useState('');
	const [isChangingPassword, setIsChangingPassword] = useState(false);

	/** `null` của API thành chuỗi rỗng để người dùng thấy ô trống mà điền; `resetFields` xoá lỗi cũ. */
	const fillProfileForm = useCallback(
		(data: UserDetail) => {
			profileForm.resetFields();
			profileForm.setFieldsValue({
				fullName: data.fullName,
				phone: data.phone ?? '',
				major: data.major ?? '',
				bio: data.bio ?? '',
			});
		},
		[profileForm],
	);

	useEffect(() => {
		// Cờ `cancelled` chặn setState sau khi rời trang (đổi route khi request còn bay).
		let cancelled = false;

		const load = async () => {
			setIsLoading(true);
			setLoadError('');

			try {
				const response = await getMyProfile();
				if (cancelled) return;

				if (!response.data) {
					setLoadError('Không tải được hồ sơ, vui lòng thử lại.');
					return;
				}

				setProfile(response.data);
				fillProfileForm(response.data);
			} catch (error) {
				if (cancelled) return;
				setLoadError(
					getApiErrorMessage(error, 'Không tải được hồ sơ, vui lòng thử lại.'),
				);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [fillProfileForm]);

	/**
	 * Header đọc `user` từ Redux nên cập nhật store là đủ để tên đổi ngay, không cần F5.
	 * Ghi luôn `localStorage` bằng helper chung (`setStoredSession`) để lần tải lại sau đó
	 * `AuthProvider` hydrate đúng hồ sơ mới thay vì tên cũ.
	 */
	const syncSessionUser = (updated: UserDetail) => {
		dispatch(updateUser(updated));
		if (accessToken && refreshToken) {
			setStoredSession({ accessToken, refreshToken, user: updated });
		}
	};

	const handleProfileSubmit = async (values: ProfileFormValues) => {
		setIsSaving(true);
		setSaveError('');

		// Ô để trống = XOÁ trường: gửi `null`, vì `undefined` (bỏ khoá) nghĩa là "giữ nguyên".
		const payload: UpdateMyProfilePayload = {
			fullName: values.fullName.trim(),
			phone: values.phone?.trim() || null,
			major: values.major?.trim() || null,
			bio: values.bio?.trim() || null,
		};

		try {
			const response = await updateMyProfile(payload);
			if (!response.data) {
				setSaveError('Cập nhật hồ sơ thất bại, vui lòng thử lại.');
				return;
			}

			setProfile(response.data);
			fillProfileForm(response.data);
			syncSessionUser(response.data);
			message.success(response.message || 'Cập nhật hồ sơ thành công');
		} catch (error) {
			// 400 của validate pipe là mảng message tiếng Việt — `getApiErrorMessage` đã join lại.
			setSaveError(
				getApiErrorMessage(error, 'Cập nhật hồ sơ thất bại, vui lòng thử lại.'),
			);
		} finally {
			setIsSaving(false);
		}
	};

	const handleChangePassword = async (values: ChangePasswordFormValues) => {
		setIsChangingPassword(true);
		setPasswordError('');

		try {
			const response = await changePassword({
				currentPassword: values.currentPassword,
				newPassword: values.newPassword,
			});

			message.success(
				response.message || 'Đổi mật khẩu thành công, vui lòng đăng nhập lại.',
			);

			// Mọi refresh token đã bị thu hồi ở backend ⇒ dùng `logout()` của context để dọn
			// cả Redux store lẫn `localStorage` (không tự xoá tay), rồi về trang đăng nhập.
			await logout();
			navigate('/login', { replace: true });
		} catch (error) {
			// Sai mật khẩu hiện tại / trùng mật khẩu cũ là 400 kèm câu tiếng Việt — hiện nguyên văn.
			setPasswordError(
				getApiErrorMessage(error, 'Đổi mật khẩu thất bại, vui lòng thử lại.'),
			);
		} finally {
			setIsChangingPassword(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center p-gutter">
				<Spin size="large" />
			</div>
		);
	}

	if (loadError || !profile) {
		return (
			<div className="space-y-space-lg p-gutter">
				<h1 className="font-headline-lg font-headline-lg text-on-surface">
					Hồ sơ cá nhân
				</h1>
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					{loadError || 'Không tải được hồ sơ, vui lòng thử lại.'}
				</ErrorBadge>
			</div>
		);
	}

	return (
		<div className="space-y-space-lg p-gutter">
			<div className="flex flex-wrap items-center gap-space-sm">
				<h1 className="font-headline-lg font-headline-lg text-on-surface">
					Hồ sơ cá nhân
				</h1>
				<Badge status={getRoleBadgeTone(profile.role)} size="md" dot>
					{USER_ROLE_LABEL[profile.role]}
				</Badge>
			</div>

			<div className="grid grid-cols-1 gap-space-lg xl:grid-cols-3">
				<section className="space-y-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm xl:col-span-2">
					<div className="space-y-1">
						<h2 className="font-title-lg font-title-lg text-on-surface">
							Thông tin cá nhân
						</h2>
						<p className="font-body-sm font-body-sm text-on-surface-variant">
							Cập nhật họ tên, số điện thoại, ngành học và phần giới thiệu của
							bạn. Để trống một ô nghĩa là xoá thông tin đó.
						</p>
					</div>

					{saveError && (
						<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
							{saveError}
						</ErrorBadge>
					)}

					<Form<ProfileFormValues>
						form={profileForm}
						layout="vertical"
						requiredMark={false}
						onFinish={handleProfileSubmit}
					>
						<FormItem
							formItemProps={{ label: 'Họ và tên', name: 'fullName' }}
							inputProps={{
								size: 'large',
								placeholder: 'Nguyễn Văn An',
								autoComplete: 'name',
							}}
							rules={[
								{
									required: true,
									message: 'Họ và tên không được để trống',
								},
								{
									min: 2,
									message: 'Họ và tên phải có ít nhất 2 ký tự',
								},
								{
									max: 255,
									message: 'Họ và tên tối đa 255 ký tự',
								},
							]}
						/>

						<FormItem
							formItemProps={{
								label: 'Số điện thoại',
								name: 'phone',
							}}
							inputProps={{
								size: 'large',
								placeholder: '0901234567',
								autoComplete: 'tel',
							}}
							rules={[
								{
									pattern: PHONE_PATTERN,
									message: 'Số điện thoại không hợp lệ (ví dụ: 0901234567).',
								},
							]}
						/>

						<FormItem
							formItemProps={{ label: 'Ngành học', name: 'major' }}
							inputProps={{
								size: 'large',
								placeholder: 'Kỹ thuật phần mềm',
							}}
							rules={[
								{
									max: 255,
									message: 'Ngành học tối đa 255 ký tự',
								},
							]}
						/>

						<FormItem
							formItemProps={{ label: 'Giới thiệu', name: 'bio' }}
							rules={[
								{
									max: 1000,
									message: 'Giới thiệu tối đa 1000 ký tự',
								},
							]}
						>
							<Input.TextArea
								rows={4}
								maxLength={1000}
								showCount
								placeholder="Vài dòng về bản thân, mục tiêu học tập…"
							/>
						</FormItem>

						<div className="flex flex-wrap justify-end gap-space-sm">
							<IOutLinedBtn
								disabled={isSaving}
								onClick={() => fillProfileForm(profile)}
							>
								Hoàn tác
							</IOutLinedBtn>
							<ISolidBtn type="primary" htmlType="submit" loading={isSaving}>
								Lưu thay đổi
							</ISolidBtn>
						</div>
					</Form>
				</section>

				<section className="space-y-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
					<div className="space-y-1">
						<h2 className="font-title-lg font-title-lg text-on-surface">
							Thông tin tài khoản
						</h2>
						<p className="font-body-sm font-body-sm text-on-surface-variant">
							Các trường này do nhà trường quản lý, bạn không thể tự sửa.
						</p>
					</div>

					<div className="space-y-space-md">
						<InfoRow label="Email">{profile.email}</InfoRow>

						<InfoRow label="Vai trò">
							<Badge status={getRoleBadgeTone(profile.role)} dot>
								{USER_ROLE_LABEL[profile.role]}
							</Badge>
						</InfoRow>

						<InfoRow label="Trạng thái">
							<Badge status={getStatusBadgeTone(profile.status)} dot>
								{USER_STATUS_LABEL[profile.status]}
							</Badge>
						</InfoRow>

						<InfoRow label="Mã sinh viên">{profile.studentCode || '—'}</InfoRow>

						<InfoRow label="Ngày tham gia">
							{dayjs(profile.createdAt).format('DD/MM/YYYY')}
						</InfoRow>
					</div>
				</section>
			</div>

			<section className="max-w-2xl space-y-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
				<div className="space-y-1">
					<h2 className="font-title-lg font-title-lg text-on-surface">
						Đổi mật khẩu
					</h2>
					<p className="font-body-sm font-body-sm text-on-surface-variant">
						Sau khi đổi mật khẩu, mọi phiên đăng nhập sẽ bị thu hồi và bạn cần
						đăng nhập lại.
					</p>
				</div>

				{passwordError && (
					<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
						{passwordError}
					</ErrorBadge>
				)}

				<Form<ChangePasswordFormValues>
					form={passwordForm}
					layout="vertical"
					requiredMark={false}
					onFinish={handleChangePassword}
				>
					<FormItem
						formItemProps={{
							label: 'Mật khẩu hiện tại',
							name: 'currentPassword',
						}}
						rules={[
							{
								required: true,
								message: 'Mật khẩu hiện tại không được để trống',
							},
						]}
					>
						<Input.Password
							size="large"
							autoComplete="current-password"
							placeholder="Nhập mật khẩu hiện tại"
						/>
					</FormItem>

					{/* Dùng chung `PasswordInput`/`ConfirmPassword` với trang đăng ký ⇒ cùng policy 8–16
					    ký tự, hoa/thường/số/ký tự đặc biệt, và cùng câu thông báo lỗi. */}
					<PasswordInput
						formItemProps={{
							label: 'Mật khẩu mới',
							name: 'newPassword',
						}}
						autoComplete="new-password"
						placeholder="Từ 8 đến 16 ký tự"
					/>

					<ConfirmPassword
						form={passwordForm}
						formItemProps={{
							label: 'Xác nhận mật khẩu mới',
							name: 'confirmPassword',
						}}
						compareFieldName="newPassword"
						autoComplete="new-password"
						placeholder="Nhập lại mật khẩu mới"
					/>

					<ISolidBtn
						type="primary"
						htmlType="submit"
						loading={isChangingPassword}
					>
						Đổi mật khẩu
					</ISolidBtn>
				</Form>
			</section>
		</div>
	);
};

export default ProfilePage;
