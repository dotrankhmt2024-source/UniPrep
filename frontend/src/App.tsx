import { Suspense, useMemo } from 'react';
import { StyleProvider } from '@ant-design/cssinjs';
import { ConfigProvider, Spin } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { ThemeProvider } from '@/contexts/theme-context';
import { useAppTheme } from '@/contexts/theme';
import { getAntdTheme } from '@/config/antd-theme';
import AppRoutes from '@/routes';
import './styles/theme.css';

dayjs.locale('vi');

/** Wraps the app in antd's ConfigProvider so every shared component picks up the M3 theme. */
const ThemedApp = () => {
	const { mode } = useAppTheme();
	const antdTheme = useMemo(() => getAntdTheme(mode === 'dark'), [mode]);

	return (
		<StyleProvider hashPriority="low">
			<ConfigProvider locale={viVN} theme={antdTheme}>
				<Suspense
					fallback={
						<div className="flex min-h-screen items-center justify-center bg-background">
							<Spin size="large" />
						</div>
					}
				>
					<AppRoutes />
				</Suspense>
			</ConfigProvider>
		</StyleProvider>
	);
};

const App = () => {
	return (
		<ThemeProvider>
			<ThemedApp />
		</ThemeProvider>
	);
};

export default App;
