import { createBrowserRouter, RouterProvider } from 'react-router';
import { lazy } from '@/utils/lazy';
import PrivateLayout from '@/layouts/private';
import AuthLayout from '@/layouts/auth';
import ProtectedRoute from './protected-route';

const CourseListPage = lazy(() => import('@/pages/course-list'));
const CourseContentPage = lazy(() => import('@/pages/course-content'));
const ProfilePage = lazy(() => import('@/pages/profile'));
const AdminUsersPage = lazy(() => import('@/pages/admin/users'));
const LoginPage = lazy(() => import('@/pages/auth/login'));
const RegisterPage = lazy(() => import('@/pages/auth/register'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/forgot-password'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/reset-password'));
const NotFoundPage = lazy(() => import('@/pages/not-found'));

/**
 * Định tuyến hai nhánh:
 * - **Công khai** (`layouts/auth`, 1 cột): đăng nhập / đăng ký / quên mật khẩu / đặt lại mật khẩu.
 * - **Riêng tư** (`layouts/private`, có Header + Sider): bọc `ProtectedRoute` để chặn người chưa
 *   đăng nhập và lọc theo vai trò. Route chỉ dành cho một vai trò thì thêm `allowedRoles` vào
 *   một phần tử bọc riêng, ví dụ:
 *   `{ element: <ProtectedRoute allowedRoles={['teacher', 'admin']} />, children: [...] }`
 */
const router = createBrowserRouter([
	{
		path: '/',
		Component: AuthLayout,
		children: [
			{ path: 'login', Component: LoginPage },
			{ path: 'register', Component: RegisterPage },
			{ path: 'forgot-password', Component: ForgotPasswordPage },
			{ path: 'reset-password', Component: ResetPasswordPage },
		],
	},
	{
		path: '/',
		Component: ProtectedRoute,
		children: [
			{
				Component: PrivateLayout,
				children: [
					{ index: true, Component: CourseListPage },
					{ path: 'courses/:courseId', Component: CourseContentPage },
					// Hồ sơ cá nhân (E2-T4): mọi vai trò đã đăng nhập đều sửa được hồ sơ của mình.
					{ path: 'profile', Component: ProfilePage },
					// Quản lý người dùng (E2-T5): chỉ admin — bọc thêm một `ProtectedRoute` có
					// `allowedRoles` nằm TRONG layout private để người sai vai trò vẫn thấy layout
					// và được đưa về trang chủ kèm thông báo, thay vì màn hình trắng.
					{
						element: <ProtectedRoute allowedRoles={['admin']} />,
						children: [{ path: 'admin/users', Component: AdminUsersPage }],
					},
					// Đường dẫn lạ vẫn nằm trong layout private ⇒ người chưa đăng nhập vẫn được
					// `ProtectedRoute` đưa về `/login`, không thấy màn hình 404 trần.
					{ path: '*', Component: NotFoundPage },
				],
			},
		],
	},
]);

const AppRoutes = () => <RouterProvider router={router} />;

export default AppRoutes;
