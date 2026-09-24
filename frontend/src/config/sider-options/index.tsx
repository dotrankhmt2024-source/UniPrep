import type { ReactNode } from 'react';
import { BookOutlined, ReadOutlined, TeamOutlined } from '@ant-design/icons';

/**
 * Single source of truth for the private-layout navigation.
 * `layouts/private/Sider` renders this; pages must never hardcode nav links.
 */
export interface SidebarItem {
	key: string;
	label: string;
	icon?: ReactNode;
	path?: string;
	group?: string;
	children?: SidebarItem[];
}

export const sidebarMenu: SidebarItem[] = [
	{
		key: 'course-list',
		label: 'Các khoá học của tôi',
		icon: <BookOutlined />,
		path: '/',
		group: 'HỌC TẬP',
	},
	{
		key: 'course-content',
		label: 'Nội dung khoá học',
		icon: <ReadOutlined />,
		path: '/courses/79738_CO2004_010915_CQ',
		group: 'HỌC TẬP',
	},
	{
		key: 'students',
		label: 'Sinh viên (module mẫu)',
		icon: <TeamOutlined />,
		path: '/students',
		group: 'QUẢN TRỊ',
	},
];

export default sidebarMenu;
