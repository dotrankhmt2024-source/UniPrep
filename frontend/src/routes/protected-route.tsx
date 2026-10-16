import { useEffect } from 'react';
import { Spin, message } from 'antd';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/contexts/auth-context';
import type { UserRole } from '@/types';

/**
 * Chốt chặn phía client cho mọi route cần đăng nhập (E1-T8).
 *
 * Đây KHÔNG phải lớp bảo mật thật — backend vẫn là nơi quyết định (guard + 403).
 * Mục đích ở đây chỉ là điều hướng cho êm: người chưa đăng nhập không thấy layout private,
 * người sai vai trò không thấy menu/trang của vai trò khác.
 */
export interface ProtectedRouteProps {
	/** Bỏ trống = mọi vai trò đã đăng nhập đều vào được. */
	allowedRoles?: UserRole[];
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
	const { user, isAuthenticated, isInitializing } = useAuth();
	const location = useLocation();
	const hasRoleAccess =
		!allowedRoles || (!!user && allowedRoles.includes(user.role));
	const isForbidden = isAuthenticated && !!user && !hasRoleAccess;

	useEffect(() => {
		// Chỉ báo một lần cho mỗi lần đổi route: `useEffect` không chạy lại khi component
		// re-render với cùng `pathname` nên không có vòng lặp thông báo.
		if (isForbidden) message.error('Bạn không có quyền truy cập trang này.');
	}, [isForbidden, location.pathname]);

	// Đang đọc phiên từ localStorage: hiện Spin thay vì đá về /login rồi lại vào — tránh "chớp" màn hình.
	if (isInitializing) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<Spin size="large" />
			</div>
		);
	}

	if (!isAuthenticated) {
		const redirect = encodeURIComponent(location.pathname + location.search);
		return <Navigate to={`/login?redirect=${redirect}`} replace />;
	}

	if (!hasRoleAccess) {
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
};

export default ProtectedRoute;
