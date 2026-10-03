import type { ReactNode } from 'react';
import {
	BookOutlined,
	IdcardOutlined,
	ReadOutlined,
	TeamOutlined,
} from '@ant-design/icons';
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
		label: 'Khoá học',
		icon: <BookOutlined />,
		path: '/',
		group: 'HỌC TẬP',
	},
	{
		key: 'teacher-courses',
		label: 'Soạn nội dung',
		icon: <ReadOutlined />,
		// Trước E3 mục này trỏ cứng vào một ID khoá học giả trong `src/mocks/course.ts`
		// (`/courses/79738_CO2004_010915_CQ`). Mock đã bị xoá ở E3-T6 nên menu trỏ tới khu soạn
		// nội dung thật; giảng viên vào đó chọn khoá mình phụ trách.
		path: '/teacher/courses',
		roles: ['teacher', 'admin'],
		group: 'GIẢNG DẠY',
	},
	{
		key: 'profile',
		label: 'Hồ sơ cá nhân',
		icon: <IdcardOutlined />,
		path: '/profile',
		group: 'TÀI KHOẢN',
	},
	{
		key: 'admin-users',
		label: 'Quản lý người dùng',
		icon: <TeamOutlined />,
		path: '/admin/users',
		// Chỉ admin thấy mục này; `filterSidebarByRole` lọc menu, `ProtectedRoute` chặn cả route.
		roles: ['admin'],
		group: 'QUẢN TRỊ',
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
