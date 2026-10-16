import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { Spin } from 'antd';
import Icon from '@/components/Icon';

/**
 * Layout cho các trang công khai (đăng nhập / đăng ký / quên mật khẩu / đặt lại mật khẩu).
 *
 * Một cột, căn giữa, KHÔNG dùng `layouts/private` (không header, không sider) vì người dùng
 * chưa có phiên. Mọi trang con chỉ render phần nội dung của mình trong `<Outlet />`.
 */
const AuthLayout = () => {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background px-gutter py-space-xl font-body-md text-on-surface">
			<div className="mb-space-lg flex flex-col items-center gap-space-sm">
				<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-white">
					<Icon name="school" size={30} />
				</div>
				<div className="text-center">
					<h1 className="font-headline-lg font-headline-lg font-bold tracking-tight text-on-surface">
						UniPrep
					</h1>
					<p className="font-label-md font-label-md text-on-surface-variant">
						Hệ thống học tập &amp; luyện thi
					</p>
				</div>
			</div>

			<div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-space-xl shadow-sm">
				<Suspense
					fallback={
						<div className="flex min-h-[240px] items-center justify-center">
							<Spin size="large" />
						</div>
					}
				>
					<Outlet />
				</Suspense>
			</div>

			<p className="mt-space-lg text-center font-label-sm font-label-sm text-on-surface-variant">
				© {new Date().getFullYear()} UniPrep — Đồ án tốt nghiệp
			</p>
		</div>
	);
};

export default AuthLayout;
