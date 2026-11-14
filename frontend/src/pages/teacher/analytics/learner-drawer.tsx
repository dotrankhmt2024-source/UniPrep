import { useEffect, useState } from 'react';
import {
	Descriptions,
	Drawer,
	Empty,
	Spin,
	Tag,
	Timeline,
	message,
} from 'antd';
import dayjs from 'dayjs';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { getLearnerDetail } from '@/apis/analytics';
import { Badge } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import {
	INTERVENTION_ACTION_LABEL,
	RISK_LEVEL_LABEL,
	type LearnerDetail,
	type LearnerRisk,
} from '@/types';
import { ChartCard } from './charts';
import { RISK_BADGE, useVizTheme, weekLabel } from './viz';

const OUTCOME_LABEL: Record<string, string> = {
	improved: 'Tiến bộ',
	no_change: 'Không đổi',
	worsened: 'Xấu đi',
	unknown: 'Chưa rõ',
};

const feature = (value: number | null, suffix = '') =>
	value === null ? '—' : `${Math.round(value * 10) / 10}${suffix}`;

/** Drill-down một học viên: lý do + số liệu thật, lịch sử điểm rủi ro, hoạt động theo tuần, can thiệp. */
const LearnerDrawer = ({
	courseId,
	learner,
	onClose,
}: {
	courseId: string;
	learner: LearnerRisk | null;
	onClose: () => void;
}) => {
	const theme = useVizTheme();
	const [detail, setDetail] = useState<LearnerDetail | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!learner) return;
		let cancelled = false;
		setLoading(true);
		setDetail(null);
		getLearnerDetail(courseId, learner.userId)
			.then((res) => !cancelled && setDetail(res.data))
			.catch((error) => !cancelled && message.error(getApiErrorMessage(error)))
			.finally(() => !cancelled && setLoading(false));
		return () => {
			cancelled = true;
		};
	}, [courseId, learner]);

	const f = learner?.features;
	const history = (detail?.history ?? []).map((row) => ({
		at: dayjs(row.computedAt).format('DD/MM HH:mm'),
		score: Number(row.score.toFixed(3)),
	}));

	return (
		<Drawer
			open={!!learner}
			onClose={onClose}
			width={720}
			title={learner?.fullName}
		>
			{learner && f && (
				<div className="space-y-space-md">
					<div className="flex flex-wrap items-center gap-2">
						<Badge status={RISK_BADGE[learner.level]} dot>
							Rủi ro {RISK_LEVEL_LABEL[learner.level].toLowerCase()}
						</Badge>
						<span className="text-body-sm text-on-surface-variant">
							điểm {learner.score.toFixed(2)} · tính lúc{' '}
							{dayjs(learner.computedAt).format('DD/MM/YYYY HH:mm')}
						</span>
					</div>

					<section className="space-y-1">
						<h3 className="font-title-sm font-semibold">
							Vì sao (luật ASP đã kích hoạt)
						</h3>
						{learner.reasons.length ? (
							learner.reasons.map((reason) => (
								<div
									key={reason.signal}
									className="flex items-center justify-between gap-2 text-body-md"
								>
									<span>
										<Tag>{reason.label}</Tag> {reason.detail}
									</span>
									<span className="text-body-sm text-on-surface-variant">
										+{reason.weight.toFixed(2)}
									</span>
								</div>
							))
						) : (
							<p className="text-body-md text-on-surface-variant">
								Không có tín hiệu rủi ro.
							</p>
						)}
						{learner.exceptions.map((item) => (
							<p
								key={item.signal}
								className="text-body-sm text-on-surface-variant"
							>
								Ngoại lệ: {item.detail}.
							</p>
						))}
					</section>

					<Descriptions
						size="small"
						bordered
						column={2}
						title="Số liệu đầu vào"
					>
						<Descriptions.Item label="Ngày từ lần học cuối">
							{feature(f.recencyDays)}
						</Descriptions.Item>
						<Descriptions.Item label="Ngày học (14 ngày qua / 14 ngày trước)">
							{f.activeDays14} / {f.activeDaysPrev14}
						</Descriptions.Item>
						<Descriptions.Item label="Bài đến hạn chưa xong">
							{f.dueMissed} / {f.dueTotal}
						</Descriptions.Item>
						<Descriptions.Item label="Bài nộp trễ">
							{f.lateCount}
						</Descriptions.Item>
						<Descriptions.Item label="Điểm trung bình">
							{feature(f.avgScore, '/100')}
						</Descriptions.Item>
						<Descriptions.Item label="Xu hướng điểm">
							{feature(f.scoreTrend)}
						</Descriptions.Item>
					</Descriptions>

					{loading ? (
						<div className="flex justify-center py-8">
							<Spin />
						</div>
					) : (
						detail && (
							<>
								<ChartCard
									title="Điểm rủi ro qua các lần chạy (0–1)"
									height={180}
								>
									{history.length ? (
										<ResponsiveContainer width="100%" height="100%">
											<LineChart
												data={history}
												margin={{ top: 8, right: 12, bottom: 0, left: -16 }}
											>
												<CartesianGrid stroke={theme.grid} vertical={false} />
												<XAxis
													dataKey="at"
													tick={{ fill: theme.axis, fontSize: 11 }}
													stroke={theme.grid}
												/>
												<YAxis
													domain={[0, 1]}
													tick={{ fill: theme.axis, fontSize: 11 }}
													stroke={theme.grid}
												/>
												<Tooltip
													formatter={(value: number) => [value, 'Điểm rủi ro']}
												/>
												<Line
													dataKey="score"
													stroke={theme.series1}
													strokeWidth={2}
													dot={{ r: 4 }}
												/>
											</LineChart>
										</ResponsiveContainer>
									) : (
										<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
									)}
								</ChartCard>
								<ChartCard title="Số ngày có học mỗi tuần" height={160}>
									<ResponsiveContainer width="100%" height="100%">
										<BarChart
											data={detail.weekly}
											margin={{ top: 8, right: 12, bottom: 0, left: -16 }}
										>
											<CartesianGrid stroke={theme.grid} vertical={false} />
											<XAxis
												dataKey="weekStart"
												tickFormatter={weekLabel}
												tick={{ fill: theme.axis, fontSize: 11 }}
												stroke={theme.grid}
											/>
											<YAxis
												domain={[0, 7]}
												allowDecimals={false}
												tick={{ fill: theme.axis, fontSize: 11 }}
												stroke={theme.grid}
											/>
											<Tooltip
												labelFormatter={(value: string) =>
													`Tuần từ ${weekLabel(value)}`
												}
												formatter={(value: number) => [value, 'Ngày có học']}
											/>
											<Bar
												dataKey="activeDays"
												fill={theme.series1}
												radius={[4, 4, 0, 0]}
												maxBarSize={24}
											/>
										</BarChart>
									</ResponsiveContainer>
								</ChartCard>
								<section className="space-y-2">
									<h3 className="font-title-sm font-semibold">
										Can thiệp đã thực hiện
									</h3>
									{detail.interventions.length ? (
										<Timeline
											items={detail.interventions.map((item) => ({
												children: (
													<div>
														<div className="font-label-md">
															{INTERVENTION_ACTION_LABEL[item.type] ??
																item.type}{' '}
															— {item.title}
														</div>
														<div className="text-body-sm text-on-surface-variant">
															{dayjs(item.sentAt ?? item.createdAt).format(
																'DD/MM/YYYY HH:mm',
															)}
															{item.acknowledgedAt
																? ' · học viên đã đọc'
																: ' · chưa đọc'}
															{item.outcome
																? ` · kết quả: ${OUTCOME_LABEL[item.outcome] ?? item.outcome}`
																: ''}
														</div>
														{item.outcomeNote && (
															<div className="text-body-sm text-on-surface-variant">
																{item.outcomeNote}
															</div>
														)}
													</div>
												),
											}))}
										/>
									) : (
										<p className="text-body-md text-on-surface-variant">
											Chưa có can thiệp nào.
										</p>
									)}
								</section>
							</>
						)
					)}
				</div>
			)}
		</Drawer>
	);
};

export default LearnerDrawer;
