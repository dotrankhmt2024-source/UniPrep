import { useMemo } from 'react';
import {
	Badge as AntBadge,
	Dropdown,
	Input,
	message,
	type MenuProps,
} from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { IconBtn, IOutLinedBtn } from '@/components';
import Icon from '@/components/Icon';
import { useAuth } from '@/contexts/auth-context';
import { USER_ROLE_LABEL, USER_STATUS_LABEL } from '@/types';

/**
 * Thanh trên cùng của layout private: thương hiệu, tìm kiếm toàn cục và cụm người dùng / thông báo.
 * Nhận trạng thái thu gọn sider từ `layouts/private`.
 */
interface HeaderProps {
	collapsed: boolean;
	isMobile: boolean;
	onToggleSider: () => void;
	onOpenMobileSider: () => void;
}

/** Chữ cái đầu của tên làm avatar chữ (chưa dùng `avatarUrl`). */
const getInitials = (fullName: string): string => {
	const parts = fullName.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';

	const first = parts[0].charAt(0);
	const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';

	return (first + last).toUpperCase();
};

const Header = ({
	collapsed,
	isMobile,
	onToggleSider,
	onOpenMobileSider,
}: HeaderProps) => {
	const navigate = useNavigate();
	const { user, logout } = useAuth();

	const handleLogout = async () => {
		// `logout()` đã gửi refresh token lên API và xoá phiên khỏi store + localStorage.
		await logout();
		message.success('Đăng xuất thành công');
		navigate('/login', { replace: true });
	};

	const accountMenu = useMemo<MenuProps['items']>(
		() => [
			{
				key: 'profile',
				icon: <Icon name="person" size={16} />,
				label: 'Hồ sơ cá nhân',
			},
			{
				key: 'settings',
				icon: <Icon name="settings" size={16} />,
				label: 'Cài đặt tài khoản',
			},
			{ type: 'divider' },
			{
				key: 'logout',
				icon: <Icon name="logout" size={16} />,
				label: 'Đăng xuất',
				danger: true,
			},
		],
		[],
	);

	const handleAccountMenuClick: MenuProps['onClick'] = ({ key }) => {
		if (key === 'logout') {
			void handleLogout();
			return;
		}

		// Trang hồ sơ thuộc E2 — ở E1 chỉ điều hướng tới route đã định.
		if (key === 'profile') navigate('/profile');
	};

	return (
		<header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-gutter">
			<div className="flex min-w-0 items-center gap-space-md">
				<IconBtn
					icon={
						isMobile || collapsed ? (
							<MenuUnfoldOutlined />
						) : (
							<MenuFoldOutlined />
						)
					}
					title={isMobile ? 'Mở menu' : 'Thu gọn / mở rộng menu'}
					onClick={isMobile ? onOpenMobileSider : onToggleSider}
				/>
				<div className="flex items-center gap-space-sm">
					<Icon name="school" size={26} className="text-secondary" />
					<span className="font-title-lg font-title-lg font-bold tracking-tight text-on-surface">
						UniPrep
					</span>
				</div>
				<Input
					allowClear
					size="large"
					prefix={<Icon name="search" size={18} className="text-outline" />}
					placeholder="Tìm khóa học, tài liệu, giảng viên..."
					className="hidden max-w-xs lg:flex"
				/>
			</div>

			<div className="flex items-center gap-space-md">
				{user && user.status !== 'active' && (
					<div className="hidden items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-low px-space-md py-1.5 md:flex">
						<Icon name="info" size={16} className="text-secondary" />
						<span className="font-label-md font-label-md font-semibold text-secondary">
							{USER_STATUS_LABEL[user.status]}
						</span>
					</div>
				)}

				<AntBadge dot color="#ba1a1a" offset={[-4, 4]}>
					<IconBtn icon={<Icon name="notifications" />} title="Thông báo" />
				</AntBadge>

				<div className="mx-1 hidden h-6 w-px bg-outline-variant sm:block" />

				<Dropdown
					menu={{ items: accountMenu, onClick: handleAccountMenuClick }}
					trigger={['click']}
					placement="bottomRight"
				>
					<IOutLinedBtn
						variant="text"
						className="h-auto gap-space-sm py-1 pl-1"
					>
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low font-title-sm font-title-sm font-bold text-secondary ring-2 ring-secondary/30">
							{user ? getInitials(user.fullName) : '?'}
						</div>
						<div className="hidden text-left xl:block">
							<p className="font-title-sm font-title-sm leading-tight text-on-surface">
								{user?.fullName ?? 'Khách'}
							</p>
							<p className="font-label-sm font-label-sm text-on-surface-variant">
								{user ? USER_ROLE_LABEL[user.role] : ''}
							</p>
						</div>
						<Icon
							name="expand_more"
							size={18}
							className="hidden text-outline sm:inline"
						/>
					</IOutLinedBtn>
				</Dropdown>
			</div>
		</header>
	);
};

export default Header;
