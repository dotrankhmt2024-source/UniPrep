import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type ThemeContextValue, type ThemeMode } from './theme';

/**
 * Provides the light/dark mode for the whole app. The matching hook lives in `contexts/theme.ts`
 * (`useAppTheme`) so this file only exports a component (React Fast Refresh requirement).
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
	const [mode, setMode] = useState<ThemeMode>('light');

	useEffect(() => {
		document.documentElement.classList.toggle('dark', mode === 'dark');
	}, [mode]);

	const value = useMemo<ThemeContextValue>(
		() => ({
			mode,
			toggleTheme: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
		}),
		[mode],
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default ThemeProvider;
