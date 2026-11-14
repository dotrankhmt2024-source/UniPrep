import type { ReactNode } from 'react';
import { Empty } from 'antd';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import type { LessonFunnelItem, WeeklyPoint } from '@/types';
import { RISK_COLOR, useVizTheme, weekLabel } from './viz';

/** Khung chung của một biểu đồ: tiêu đề nói rõ đại lượng + đơn vị, mô tả ngắn, vùng vẽ cao cố định. */
export const ChartCard = ({
	title,
	hint,
	children,
	height = 220,
}: {
	title: string;
	hint?: string;
	children: ReactNode;
	height?: number;
}) => (
	<section className="space-y-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md">
		<div>
			<h3 className="font-title-sm font-semibold text-on-surface">{title}</h3>
			{hint && <p className="text-body-sm text-on-surface-variant">{hint}</p>}
		</div>
		<div style={{ height }}>{children}</div>
	</section>
);

const tooltipStyle = {
	contentStyle: {
		background: 'var(--color-surface-container-lowest)',
		border: '1px solid var(--color-outline-variant)',
		borderRadius: 8,
		color: 'var(--color-on-surface)',
		fontSize: 12,
	},
	labelStyle: { color: 'var(--color-on-surface-variant)' },
};

const NoData = () => (
	<div className="flex h-full items-center justify-center">
		<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" />
	</div>
);

/** Một chuỗi theo tuần dạng đường (một trục, một màu — tiêu đề gọi tên chuỗi nên không cần chú giải). */
export const WeeklyLine = ({
	data,
	dataKey,
	name,
	unit,
	domain,
}: {
	data: WeeklyPoint[];
	dataKey: 'activeLearners' | 'avgScorePercent' | 'learnerDays';
	name: string;
	unit?: string;
	domain?: [number, number];
}) => {
	const theme = useVizTheme();
	if (!data.length) return <NoData />;
	return (
		<ResponsiveContainer width="100%" height="100%">
			<LineChart
				data={data}
				margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
			>
				<CartesianGrid stroke={theme.grid} vertical={false} />
				<XAxis
					dataKey="weekStart"
					tickFormatter={weekLabel}
					tick={{ fill: theme.axis, fontSize: 11 }}
					stroke={theme.grid}
				/>
				<YAxis
					tick={{ fill: theme.axis, fontSize: 11 }}
					stroke={theme.grid}
					allowDecimals={false}
					domain={domain}
				/>
				<Tooltip
					{...tooltipStyle}
					labelFormatter={(value: string) => `Tuần từ ${weekLabel(value)}`}
					formatter={(value: number) => [`${value}${unit ?? ''}`, name]}
				/>
				<Line
					type="monotone"
					dataKey={dataKey}
					name={name}
					stroke={theme.series1}
					strokeWidth={2}
					dot={{
						r: 4,
						strokeWidth: 2,
						fill: 'var(--color-surface-container-lowest)',
					}}
					activeDot={{ r: 5 }}
					connectNulls
				/>
			</LineChart>
		</ResponsiveContainer>
	);
};

/** Một chuỗi theo tuần dạng cột. */
export const WeeklyBars = ({
	data,
	dataKey,
	name,
}: {
	data: WeeklyPoint[];
	dataKey: 'lessonsCompleted' | 'submissions';
	name: string;
}) => {
	const theme = useVizTheme();
	if (!data.length) return <NoData />;
	return (
		<ResponsiveContainer width="100%" height="100%">
			<BarChart
				data={data}
				margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
			>
				<CartesianGrid stroke={theme.grid} vertical={false} />
				<XAxis
					dataKey="weekStart"
					tickFormatter={weekLabel}
					tick={{ fill: theme.axis, fontSize: 11 }}
					stroke={theme.grid}
				/>
				<YAxis
					tick={{ fill: theme.axis, fontSize: 11 }}
					stroke={theme.grid}
					allowDecimals={false}
				/>
				<Tooltip
					{...tooltipStyle}
					cursor={{ fill: theme.grid, opacity: 0.4 }}
					labelFormatter={(value: string) => `Tuần từ ${weekLabel(value)}`}
					formatter={(value: number) => [value, name]}
				/>
				<Bar
					dataKey={dataKey}
					name={name}
					fill={theme.series1}
					radius={[4, 4, 0, 0]}
					maxBarSize={28}
				/>
			</BarChart>
		</ResponsiveContainer>
	);
};

/** Số học viên theo mức rủi ro mỗi tuần (cột chồng, màu trạng thái + chú giải chữ). */
export const RiskStack = ({ data }: { data: WeeklyPoint[] }) => {
	const theme = useVizTheme();
	const rows = data
		.filter((point) => point.risk)
		.map((point) => ({ weekStart: point.weekStart, ...point.risk }));
	if (!rows.length) return <NoData />;
	return (
		<ResponsiveContainer width="100%" height="100%">
			<BarChart
				data={rows}
				margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
			>
				<CartesianGrid stroke={theme.grid} vertical={false} />
				<XAxis
					dataKey="weekStart"
					tickFormatter={weekLabel}
					tick={{ fill: theme.axis, fontSize: 11 }}
					stroke={theme.grid}
				/>
				<YAxis
					tick={{ fill: theme.axis, fontSize: 11 }}
					stroke={theme.grid}
					allowDecimals={false}
				/>
				<Tooltip
					{...tooltipStyle}
					cursor={{ fill: theme.grid, opacity: 0.4 }}
					labelFormatter={(value: string) => `Tuần từ ${weekLabel(value)}`}
				/>
				<Legend
					wrapperStyle={{
						fontSize: 12,
						color: 'var(--color-on-surface-variant)',
					}}
					iconType="circle"
				/>
				{/* Khoảng hở 2px giữa các đoạn chồng (stroke màu nền). */}
				<Bar
					dataKey="low"
					name="Thấp"
					stackId="risk"
					fill={RISK_COLOR.low}
					stroke="var(--color-surface-container-lowest)"
					strokeWidth={2}
					maxBarSize={28}
				/>
				<Bar
					dataKey="medium"
					name="Trung bình"
					stackId="risk"
					fill={RISK_COLOR.medium}
					stroke="var(--color-surface-container-lowest)"
					strokeWidth={2}
					maxBarSize={28}
				/>
				<Bar
					dataKey="high"
					name="Cao"
					stackId="risk"
					fill={RISK_COLOR.high}
					stroke="var(--color-surface-container-lowest)"
					strokeWidth={2}
					radius={[4, 4, 0, 0]}
					maxBarSize={28}
				/>
			</BarChart>
		</ResponsiveContainer>
	);
};

/** Phễu theo bài học: số học viên đã mở / đã hoàn thành từng bài (hai chuỗi phân loại, có chú giải). */
export const LessonFunnel = ({ data }: { data: LessonFunnelItem[] }) => {
	const theme = useVizTheme();
	if (!data.length) return <NoData />;
	return (
		<ResponsiveContainer width="100%" height="100%">
			<BarChart
				data={data}
				margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
				barGap={2}
			>
				<CartesianGrid stroke={theme.grid} vertical={false} />
				<XAxis
					dataKey="order"
					tickFormatter={(order: number) => `B${order}`}
					tick={{ fill: theme.axis, fontSize: 11 }}
					stroke={theme.grid}
					interval="preserveStartEnd"
				/>
				<YAxis
					tick={{ fill: theme.axis, fontSize: 11 }}
					stroke={theme.grid}
					allowDecimals={false}
				/>
				<Tooltip
					{...tooltipStyle}
					cursor={{ fill: theme.grid, opacity: 0.4 }}
					labelFormatter={(order: number) =>
						data.find((item) => item.order === order)?.title ?? `Bài ${order}`
					}
				/>
				<Legend
					wrapperStyle={{
						fontSize: 12,
						color: 'var(--color-on-surface-variant)',
					}}
					iconType="circle"
				/>
				<Bar
					dataKey="started"
					name="Đã mở"
					fill={theme.series1}
					radius={[4, 4, 0, 0]}
					maxBarSize={16}
				/>
				<Bar
					dataKey="completed"
					name="Đã hoàn thành"
					fill={theme.series2}
					radius={[4, 4, 0, 0]}
					maxBarSize={16}
				/>
			</BarChart>
		</ResponsiveContainer>
	);
};
