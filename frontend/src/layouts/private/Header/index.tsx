import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	Badge as AntBadge,
	Button,
	Dropdown,
	Empty,
	Input,
	Popover,
	Spin,
	message,
	type MenuProps,
} from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router';
import { IconBtn, IOutLinedBtn } from '@/components';
import Icon from '@/components/Icon';
import { useAuth } from '@/contexts/auth-context';
import {
	getMyNotifications,
	markAllNotificationsAsRead,
	markNotificationAsRead,
} from '@/apis';
import {
	USER_ROLE_LABEL,
	USER_STATUS_LABEL,
	type NotificationItem,
} from '@/types';

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
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const [unreadCount, setUnreadCount] = useState<number>(0);
	const [loadingNotifications, setLoadingNotifications] = useState(false);
	const [popoverOpen, setPopoverOpen] = useState(false);

	const fetchNotifications = useCallback(async () => {
		if (!user) return;
		setLoadingNotifications(true);
		try {
			const res = await getMyNotifications();
			if (res.data) {
				setNotifications(res.data.items ?? []);
				setUnreadCount(res.data.unreadCount ?? 0);
			}
		} catch {
			// Bỏ qua lỗi ngầm trên header để không làm phiền người dùng
		} finally {
			setLoadingNotifications(false);
		}
	}, [user]);

	useEffect(() => {
		void fetchNotifications();
	}, [fetchNotifications]);

	const handleOpenNotifications = (open: boolean) => {
		setPopoverOpen(open);
		if (open) {
			void fetchNotifications();
		}
	};

	const handleClickNotification = async (item: NotificationItem) => {
		if (!item.isRead) {
			try {
				await markNotificationAsRead(item.id);
				setNotifications((prev) =>
					prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
				);
				setUnreadCount((prev) => Math.max(0, prev - 1));
			} catch {
				// ignore
			}
		}

		const courseId = item.payload?.courseId;
		if (typeof courseId === 'string' && courseId) {
			setPopoverOpen(false);
			navigate(`/courses/${courseId}`);
		}
	};

	const handleMarkAllRead = async () => {
		try {
			await markAllNotificationsAsRead();
			setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
			setUnreadCount(0);
			message.success('Đã đánh dấu đọc tất cả thông báo');
		} catch {
			message.error('Không thể đánh dấu đã đọc');
		}
	};

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
				// `<Link>` thật (không điều hướng bằng tay) để mở được tab mới và giữ hành vi chuột giữa.
				label: <Link to="/profile">Hồ sơ cá nhân</Link>,
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
		// Mục "Hồ sơ cá nhân" là `<Link>` nên tự điều hướng; ở đây chỉ còn việc đăng xuất.
		if (key === 'logout') void handleLogout();
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

				<Popover
					trigger="click"
					placement="bottomRight"
					open={popoverOpen}
					onOpenChange={handleOpenNotifications}
					content={
						<div className="w-80 sm:w-96">
							<div className="mb-2 flex items-center justify-between border-b border-outline-variant/40 pb-2">
								<span className="font-title-sm font-bold text-on-surface">
									Thông báo ({unreadCount} chưa đọc)
								</span>
								{unreadCount > 0 && (
									<Button
										type="link"
										size="small"
										onClick={() => void handleMarkAllRead()}
									>
										Đánh dấu đã đọc hết
									</Button>
								)}
							</div>

							{loadingNotifications ? (
								<div className="flex justify-center py-6">
									<Spin size="small" />
								</div>
							) : notifications.length === 0 ? (
								<Empty
									image={Empty.PRESENTED_IMAGE_SIMPLE}
									description="Chưa có thông báo nào"
								/>
							) : (
								<div className="max-h-96 space-y-2 overflow-y-auto pr-1">
									{notifications.map((item) => (
										<div
											key={item.id}
											onClick={() => void handleClickNotification(item)}
											className={`cursor-pointer rounded-lg border p-3 transition ${
												item.isRead
													? 'border-outline-variant/30 bg-surface-container-lowest opacity-75'
													: 'border-secondary/40 bg-secondary/5'
											} hover:bg-surface-container-low`}
										>
											<div className="flex items-start justify-between gap-2">
												<p className="font-label-md font-semibold text-on-surface">
													{item.title}
												</p>
												{!item.isRead && (
													<span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-error" />
												)}
											</div>
											<p className="mt-1 whitespace-pre-wrap font-body-sm text-on-surface-variant">
												{item.body}
											</p>
											<p className="mt-1.5 font-label-sm text-outline">
												{new Date(item.sentAt).toLocaleString('vi-VN')}
											</p>
										</div>
									))}
								</div>
							)}
						</div>
					}
				>
					<AntBadge count={unreadCount} size="small" color="#ba1a1a" offset={[-4, 4]}>
						<IconBtn icon={<Icon name="notifications" />} title="Thông báo" />
					</AntBadge>
				</Popover>

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
