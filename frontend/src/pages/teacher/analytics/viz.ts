import { useEffect, useState } from 'react';
import type { RiskLevel } from '@/types';

/**
 * Màu biểu đồ theo bảng màu đã kiểm định (skill dataviz, `validate_palette.js`): hai slot phân loại
 * đầu (xanh dương / cam) qua mọi kiểm tra ở cả hai chế độ; mức rủi ro dùng bảng **trạng thái** cố
 * định (luôn đi kèm nhãn chữ, không dùng màu một mình). Recharts đặt màu bằng thuộc tính SVG nên không
 * đọc được `var(--…)` — hook dưới đây chọn bộ màu theo class `.dark` của `<html>`.
 */
const LIGHT = {
	series1: '#2a78d6',
	series2: '#eb6834',
	grid: '#e4e2dc',
	axis: '#6b6a65',
};
const DARK = {
	series1: '#3987e5',
	series2: '#d95926',
	grid: '#383835',
	axis: '#a3a29a',
};

export const RISK_COLOR: Record<RiskLevel, string> = {
	high: '#d03b3b',
	medium: '#fab219',
	low: '#0ca30c',
};

export type VizTheme = typeof LIGHT;

const isDark = () => document.documentElement.classList.contains('dark');

export const useVizTheme = (): VizTheme => {
	const [dark, setDark] = useState(isDark);
	useEffect(() => {
		const observer = new MutationObserver(() => setDark(isDark()));
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class'],
		});
		return () => observer.disconnect();
	}, []);
	return dark ? DARK : LIGHT;
};

/** `2026-11-09` → `09/11`. */
export const weekLabel = (iso: string) => {
	const [, month, day] = iso.split('-');
	return `${day}/${month}`;
};

export const RISK_BADGE: Record<RiskLevel, 'error' | 'warning' | 'success'> = {
	high: 'error',
	medium: 'warning',
	low: 'success',
};
