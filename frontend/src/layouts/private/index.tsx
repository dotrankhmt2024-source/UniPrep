import { Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { Spin } from 'antd';
import Header from './Header';
import Sider from './Sider';

/**
 * Shell for every authenticated page: top `Header`, left `Sider`, and the routed page in `<Outlet />`.
 * Pages must NOT render their own header/sidebar or full-page chrome — they render page content only.
 */
const PrivateLayout = () => {
	const [collapsed, setCollapsed] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);

	useEffect(() => {
		const updateScreenMode = () => {
			const mobile = window.innerWidth < 1024;
			setIsMobile(mobile);
			if (!mobile) setMobileOpen(false);
		};

		updateScreenMode();
		window.addEventListener('resize', updateScreenMode);
		return () => window.removeEventListener('resize', updateScreenMode);
	}, []);

	return (
		<div className="flex min-h-screen flex-col bg-background font-body-md text-on-surface">
			<Header
				collapsed={collapsed}
				isMobile={isMobile}
				onToggleSider={() => setCollapsed((prev) => !prev)}
				onOpenMobileSider={() => setMobileOpen(true)}
			/>

			<Sider
				collapsed={collapsed}
				isMobile={isMobile}
				mobileOpen={mobileOpen}
				onCloseMobile={() => setMobileOpen(false)}
			/>

			<main
				className={`min-w-0 flex-1 bg-background transition-[margin] duration-200 ${
					collapsed ? 'lg:ml-20' : 'lg:ml-64'
				}`}
			>
				<Suspense
					fallback={
						<div className="flex min-h-[50vh] items-center justify-center">
							<Spin size="large" />
						</div>
					}
				>
					<Outlet />
				</Suspense>
			</main>
		</div>
	);
};

export default PrivateLayout;
