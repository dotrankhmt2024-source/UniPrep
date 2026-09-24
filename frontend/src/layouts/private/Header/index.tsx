import { Badge as AntBadge, Dropdown, Input, type MenuProps } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import Icon from '@/components/Icon';
import { IconBtn, IOutLinedBtn } from '@/components';

/**
 * Private-layout top bar. Owns the brand, global search, the current-semester chip and the
 * user / notification cluster. Receives the sider toggle from `layouts/private`.
 */
interface HeaderProps {
	collapsed: boolean;
	isMobile: boolean;
	onToggleSider: () => void;
	onOpenMobileSider: () => void;
}

const ACCOUNT_MENU: MenuProps['items'] = [
	{ key: 'profile', icon: <Icon name="person" size={16} />, label: 'Hồ sơ cá nhân' },
	{ key: 'settings', icon: <Icon name="settings" size={16} />, label: 'Cài đặt tài khoản' },
	{ type: 'divider' },
	{ key: 'logout', icon: <Icon name="logout" size={16} />, label: 'Đăng xuất', danger: true },
];

const Header = ({ collapsed, isMobile, onToggleSider, onOpenMobileSider }: HeaderProps) => {
	return (
		<header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-gutter">
			<div className="flex min-w-0 items-center gap-space-md">
				<IconBtn
					icon={isMobile || collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
					title={isMobile ? 'Mở menu' : 'Thu gọn / mở rộng menu'}
					onClick={isMobile ? onOpenMobileSider : onToggleSider}
				/>
				<div className="flex items-center gap-space-sm">
					<Icon name="school" size={26} className="text-secondary" />
					<span className="font-title-lg font-title-lg font-bold tracking-tight text-on-surface">EduLMS Portal</span>
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
				<div className="hidden items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-low px-space-md py-1.5 md:flex">
					<Icon name="calendar_month" size={16} className="text-secondary" />
					<span className="font-label-md font-label-md font-semibold text-secondary">Học kỳ 1 (2024-2025)</span>
				</div>

				<AntBadge dot color="#ba1a1a" offset={[-4, 4]}>
					<IconBtn icon={<Icon name="notifications" />} title="Thông báo" />
				</AntBadge>

				<div className="mx-1 hidden h-6 w-px bg-outline-variant sm:block" />

				<Dropdown menu={{ items: ACCOUNT_MENU }} trigger={['click']} placement="bottomRight">
					<IOutLinedBtn variant="text" className="h-auto gap-space-sm py-1 pl-1">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low font-title-sm font-title-sm font-bold text-secondary ring-2 ring-secondary/30">
							AN
						</div>
						<div className="hidden text-left xl:block">
							<p className="font-title-sm font-title-sm leading-tight text-on-surface">Nguyễn Văn An</p>
							<p className="font-label-sm font-label-sm text-on-surface-variant">K67 - KHMT &amp; AI</p>
						</div>
						<Icon name="expand_more" size={18} className="hidden text-outline sm:inline" />
					</IOutLinedBtn>
				</Dropdown>
			</div>
		</header>
	);
};

export default Header;
