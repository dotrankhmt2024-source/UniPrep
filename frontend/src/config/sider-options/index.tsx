import type { ReactNode } from 'react';
import { BookOutlined, ReadOutlined } from '@ant-design/icons';
import type { UserRole } from '@/types';

/**
 * Nguồn chân lý duy nhất cho menu của layout private.
 * `layouts/private/Sider` render file này; trang không được hardcode link điều hướng.
 */
export interface SidebarItem {
	key: string;
	label: string;
	icon?: ReactNode;
	path?: string;
	group?: string;
	children?: SidebarItem[];
	/** Vai trò được thấy mục này. Bỏ trống = mọi vai trò đã đăng nhập đều thấy. */
	roles?: UserRole[];
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
];

/**
 * Lọc menu theo vai trò người dùng hiện tại.
 *
 * Lọc **cả cấp con**: một mục cha bị ẩn thì mục con của nó cũng biến mất, nếu không
 * menu vẫn lộ tên trang mà vai trò đó không được vào.
 */
export const filterSidebarByRole = (
	items: SidebarItem[],
	role?: UserRole,
): SidebarItem[] => {
	if (!role) return [];

	return items
		.filter((item) => !item.roles || item.roles.includes(role))
		.map((item) =>
			item.children
				? { ...item, children: filterSidebarByRole(item.children, role) }
				: item,
		);
};

export default sidebarMenu;
