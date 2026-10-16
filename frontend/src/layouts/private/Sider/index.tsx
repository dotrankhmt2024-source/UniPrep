import { useMemo } from 'react';
import { Drawer, Menu, type MenuProps } from 'antd';
import { useLocation, useNavigate } from 'react-router';
import {
	filterSidebarByRole,
	sidebarMenu,
	type SidebarItem,
} from '@/config/sider-options';
import { useAppSelector } from '@/store/hooks';
import Icon from '@/components/Icon';
import '@/styles/sider.css';

/**
 * Điều hướng của layout private. Desktop là rail cố định, mobile nằm trong `Drawer` —
 * cả hai dùng chung một nguồn `config/sider-options` (đã lọc theo vai trò), nên đổi menu
 * chỉ phải sửa ở một chỗ.
 */
interface SiderProps {
	collapsed: boolean;
	isMobile: boolean;
	mobileOpen: boolean;
	onCloseMobile: () => void;
}

const toMenuItems = (
	items: SidebarItem[],
	collapsed: boolean,
): MenuProps['items'] => {
	const toItem = (item: SidebarItem) => ({
		key: item.key,
		icon: item.icon,
		label: item.label,
	});

	// Khi thu gọn thì bỏ nhóm: tiêu đề nhóm không ẩn được trong rail 80px nên sẽ bị cắt cụt.
	if (collapsed) return items.map(toItem);

	const groups: { group: string; items: SidebarItem[] }[] = [];

	items.forEach((item) => {
		const groupName = item.group || 'KHÁC';
		const existing = groups.find((entry) => entry.group === groupName);
		if (existing) existing.items.push(item);
		else groups.push({ group: groupName, items: [item] });
	});

	return groups.map((entry) => ({
		type: 'group' as const,
		label: entry.group,
		children: entry.items.map(toItem),
	}));
};

const flattenItems = (items: SidebarItem[]): SidebarItem[] =>
	items.flatMap((item) =>
		item.children ? flattenItems(item.children) : [item],
	);

const findActiveKey = (items: SidebarItem[], pathname: string): string => {
	const flat = flattenItems(items);

	const exact = flat.find((item) => item.path === pathname);
	if (exact) return exact.key;

	const prefixMatch = flat
		.filter(
			(item) =>
				item.path && item.path !== '/' && pathname.startsWith(item.path),
		)
		.sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))[0];

	return prefixMatch?.key || '';
};

/** Mục phụ neo ở đáy rail (vẫn chưa có trang nên chỉ hiển thị). */
const FOOTER_ITEMS: MenuProps['items'] = [
	{
		key: 'help',
		icon: <Icon name="help" size={18} />,
		label: 'Hỗ trợ kỹ thuật',
	},
	{
		key: 'settings',
		icon: <Icon name="settings" size={18} />,
		label: 'Cài đặt',
	},
];

interface SiderContentProps {
	items: SidebarItem[];
	collapsed: boolean;
	onNavigate: (path: string) => void;
}

const SiderContent = ({ items, collapsed, onNavigate }: SiderContentProps) => {
	const { pathname } = useLocation();
	const activeKey = findActiveKey(items, pathname);

	return (
		<div
			className={`flex h-full flex-col justify-between overflow-y-auto overflow-x-hidden py-space-lg ${
				collapsed ? 'px-0' : 'px-space-md'
			}`}
		>
			<div className="space-y-space-lg">
				<div
					className={`flex items-center gap-space-sm ${collapsed ? 'justify-center' : 'px-space-sm'}`}
				>
					<div className="w-8 h-8 shrink-0 rounded-lg bg-primary-container flex items-center justify-center text-white font-headline-sm font-headline-sm font-bold">
						U
					</div>
					{!collapsed && (
						<div>
							<div className="font-title-md font-title-md font-bold text-on-surface">
								UniPrep
							</div>
							<div className="font-label-sm font-label-sm text-on-surface-variant">
								Hệ thống Đào tạo Số
							</div>
						</div>
					)}
				</div>

				<Menu
					className="sider-menu"
					mode="inline"
					items={toMenuItems(items, collapsed)}
					selectedKeys={activeKey ? [activeKey] : []}
					inlineCollapsed={collapsed}
					style={{ borderInlineEnd: 'none', background: 'transparent' }}
					onClick={({ key }) => {
						const target = flattenItems(items).find((item) => item.key === key);
						if (target?.path) onNavigate(target.path);
					}}
				/>
			</div>

			<div className="border-t border-outline-variant pt-space-md">
				<Menu
					className="sider-menu"
					mode="inline"
					selectable={false}
					items={FOOTER_ITEMS}
					inlineCollapsed={collapsed}
					style={{ borderInlineEnd: 'none', background: 'transparent' }}
				/>
			</div>
		</div>
	);
};

const Sider = ({
	collapsed,
	isMobile,
	mobileOpen,
	onCloseMobile,
}: SiderProps) => {
	const navigate = useNavigate();
	const role = useAppSelector((state) => state.auth.user?.role);
	const items = useMemo(() => filterSidebarByRole(sidebarMenu, role), [role]);

	const handleNavigate = (path: string) => {
		navigate(path);
		if (isMobile) onCloseMobile();
	};

	if (isMobile) {
		return (
			<Drawer
				placement="left"
				width={272}
				open={mobileOpen}
				onClose={onCloseMobile}
				closable={false}
				styles={{
					body: {
						padding: 0,
						background: 'var(--color-surface-container-lowest)',
					},
				}}
			>
				<SiderContent
					items={items}
					collapsed={false}
					onNavigate={handleNavigate}
				/>
			</Drawer>
		);
	}

	return (
		<aside
			className={`fixed bottom-0 left-0 top-16 z-30 hidden border-r border-outline-variant bg-surface-container-lowest transition-[width] duration-200 lg:block ${
				collapsed ? 'w-20' : 'w-64'
			}`}
		>
			<SiderContent
				items={items}
				collapsed={collapsed}
				onNavigate={handleNavigate}
			/>
		</aside>
	);
};

export default Sider;
