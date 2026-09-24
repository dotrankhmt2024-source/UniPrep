import { Drawer, Menu, type MenuProps } from 'antd';
import { useLocation, useNavigate } from 'react-router';
import { sidebarMenu, type SidebarItem } from '@/config/sider-options';
import Icon from '@/components/Icon';

/**
 * Private-layout navigation. Rendered on desktop as a fixed rail and on mobile inside a Drawer —
 * both driven by `config/sider-options`, so nav changes are made in exactly one place.
 */
interface SiderProps {
	collapsed: boolean;
	isMobile: boolean;
	mobileOpen: boolean;
	onCloseMobile: () => void;
}

const toMenuItems = (items: SidebarItem[]): MenuProps['items'] => {
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
		children: entry.items.map((item) => ({
			key: item.key,
			icon: item.icon,
			label: item.label,
		})),
	}));
};

const findActiveKey = (pathname: string): string => {
	const flat: SidebarItem[] = sidebarMenu.flatMap((item) => (item.children ? item.children : [item]));

	const exact = flat.find((item) => item.path === pathname);
	if (exact) return exact.key;

	const prefixMatch = flat
		.filter((item) => item.path && item.path !== '/' && pathname.startsWith(item.path))
		.sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))[0];

	return prefixMatch?.key || '';
};

/** Secondary entries pinned to the bottom of the rail (still inert until those pages exist). */
const FOOTER_ITEMS: MenuProps['items'] = [
	{ key: 'help', icon: <Icon name="help" size={18} />, label: 'Hỗ trợ kỹ thuật' },
	{ key: 'settings', icon: <Icon name="settings" size={18} />, label: 'Cài đặt' },
];

const SiderContent = ({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: (path: string) => void }) => {
	const { pathname } = useLocation();
	const activeKey = findActiveKey(pathname);

	return (
		<div className="flex h-full flex-col justify-between overflow-y-auto px-space-md py-space-lg">
			<div className="space-y-space-lg">
				<div className={`flex items-center gap-space-sm px-space-sm ${collapsed ? 'justify-center' : ''}`}>
					<div className="w-8 h-8 shrink-0 rounded-lg bg-primary-container flex items-center justify-center text-white font-headline-sm font-headline-sm font-bold">
						E
					</div>
					{!collapsed && (
						<div>
							<div className="font-title-md font-title-md font-bold text-on-surface">EduLMS Portal</div>
							<div className="font-label-sm font-label-sm text-on-surface-variant">Hệ thống Đào tạo Số</div>
						</div>
					)}
				</div>

				<Menu
					mode="inline"
					items={toMenuItems(sidebarMenu)}
					selectedKeys={activeKey ? [activeKey] : []}
					inlineCollapsed={collapsed}
					style={{ borderInlineEnd: 'none', background: 'transparent' }}
					onClick={({ key }) => {
						const flat: SidebarItem[] = sidebarMenu.flatMap((item) => (item.children ? item.children : [item]));
						const target = flat.find((item) => item.key === key);
						if (target?.path) onNavigate(target.path);
					}}
				/>
			</div>

			<div className="border-t border-outline-variant pt-space-md">
				<Menu
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

const Sider = ({ collapsed, isMobile, mobileOpen, onCloseMobile }: SiderProps) => {
	const navigate = useNavigate();

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
				styles={{ body: { padding: 0, background: 'var(--color-surface-container-lowest)' } }}
			>
				<SiderContent collapsed={false} onNavigate={handleNavigate} />
			</Drawer>
		);
	}

	return (
		<aside
			className={`fixed bottom-0 left-0 top-16 z-30 hidden border-r border-outline-variant bg-surface-container-lowest transition-[width] duration-200 lg:block ${
				collapsed ? 'w-20' : 'w-64'
			}`}
		>
			<SiderContent collapsed={collapsed} onNavigate={handleNavigate} />
		</aside>
	);
};

export default Sider;
