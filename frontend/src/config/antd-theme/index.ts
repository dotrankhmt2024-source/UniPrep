import { theme, type ThemeConfig } from 'antd';

/**
 * Ant Design theme mapped onto the Material 3 design tokens declared in `styles/theme.css`.
 * Keep the hex values in sync with `@theme { ... }` there — they are the single source of truth
 * for the UniPrep design system (extracted from `frontend/design/*.html`).
 */
export const BRAND = {
	primary: '#006398', // --color-secondary
	primaryHover: '#00476e', // --color-on-secondary-container
	navy: '#131b2e', // --color-primary-container
	error: '#ba1a1a', // --color-error
	surface: '#f8f9ff', // --color-surface
	surfaceLowest: '#ffffff', // --color-surface-container-lowest
	text: '#0b1c30', // --color-on-surface
	border: '#c6c6cd', // --color-outline-variant
} as const;

const FONT_FAMILY = '"Hanken Grotesk", "Source Serif 4", system-ui, sans-serif';

/**
 * Builds the ConfigProvider theme for the current colour mode.
 * Uses the same M3 palette in dark mode so custom Tailwind colours and antd stay consistent.
 */
export const getAntdTheme = (isDark: boolean): ThemeConfig => ({
	algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
	token: {
		colorPrimary: BRAND.primary,
		colorError: BRAND.error,
		colorLink: BRAND.primary,
		colorTextBase: isDark ? '#eaf1ff' : BRAND.text,
		colorBgBase: isDark ? '#0b1220' : BRAND.surface,
		colorBgLayout: isDark ? '#0b1220' : BRAND.surface,
		colorBgContainer: isDark ? '#10192b' : BRAND.surfaceLowest,
		colorBgElevated: isDark ? '#16223a' : BRAND.surfaceLowest,
		colorBorder: isDark ? '#2c3a56' : BRAND.border,
		colorBorderSecondary: isDark ? '#243049' : '#e2e5ee',
		borderRadius: 10,
		borderRadiusLG: 12,
		borderRadiusSM: 8,
		controlHeight: 40,
		fontFamily: FONT_FAMILY,
		fontSize: 14,
	},
	components: {
		Button: {
			controlHeight: 40,
			controlHeightLG: 44,
			controlHeightSM: 32,
			fontWeight: 600,
			borderRadius: 10,
			paddingInline: 16,
			defaultShadow: 'none',
			primaryShadow: 'none',
			dangerShadow: 'none',
		},
		Input: {
			controlHeight: 40,
			borderRadius: 10,
			activeBorderColor: BRAND.primary,
			hoverBorderColor: BRAND.primary,
			colorBgContainer: isDark ? '#10192b' : BRAND.surfaceLowest,
		},
		Select: {
			controlHeight: 40,
			borderRadius: 10,
			optionSelectedBg: isDark ? 'rgba(0, 99, 152, 0.35)' : 'rgba(0, 99, 152, 0.12)',
			optionActiveBg: isDark ? 'rgba(0, 99, 152, 0.22)' : '#eff4ff',
		},
		Table: {
			borderRadiusLG: 12,
			headerBg: isDark ? '#16223a' : '#eff4ff',
			headerColor: isDark ? '#eaf1ff' : '#45464d',
			headerSplitColor: 'transparent',
			rowHoverBg: isDark ? 'rgba(0, 99, 152, 0.16)' : 'rgba(0, 99, 152, 0.06)',
			cellPaddingBlock: 14,
			cellPaddingInline: 16,
			fontSize: 14,
		},
		Form: {
			labelColor: isDark ? '#b4c0d6' : '#45464d',
			itemMarginBottom: 18,
			verticalLabelPadding: '0 0 6px',
		},
		Modal: {
			borderRadiusLG: 14,
			paddingContentHorizontalLG: 24,
		},
		Card: {
			borderRadiusLG: 12,
		},
		Pagination: {
			borderRadius: 10,
			itemActiveBg: BRAND.primary,
		},
		Layout: {
			headerBg: isDark ? '#10192b' : BRAND.surfaceLowest,
			siderBg: isDark ? '#10192b' : BRAND.surfaceLowest,
			bodyBg: isDark ? '#0b1220' : BRAND.surface,
		},
		Menu: {
			itemBorderRadius: 10,
			itemSelectedBg: isDark ? 'rgba(0, 99, 152, 0.28)' : '#eff4ff',
			itemSelectedColor: isDark ? '#93ccff' : BRAND.primary,
			itemHoverBg: isDark ? 'rgba(0, 99, 152, 0.18)' : '#eff4ff',
			itemColor: isDark ? '#b4c0d6' : '#45464d',
			itemHeight: 42,
		},
	},
});

export default getAntdTheme;
