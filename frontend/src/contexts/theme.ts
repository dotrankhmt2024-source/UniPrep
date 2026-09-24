import { createContext, useContext } from 'react';

/**
 * Theme context, value shape and the `useAppTheme` hook.
 *
 * Kept separate from `contexts/theme-context.tsx` (which only exports the `ThemeProvider`
 * component) so React Fast Refresh stays happy — same split as the MOVE3 repo.
 */
export type ThemeMode = 'light' | 'dark';

export interface ThemeContextValue {
	mode: ThemeMode;
	toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useAppTheme = () => {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
	return ctx;
};
